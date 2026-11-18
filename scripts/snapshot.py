#!/usr/bin/env python3
"""Capture the signed-in user's product boards in a static browser-readable snapshot."""
import json
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

SITE = Path(__file__).resolve().parents[1] / "local-archive"
TZ = "Asia/Kolkata"
PAGE = "pageInfo { hasNextPage endCursor }"
BOARD_FIELDS = """id number title url closed public updatedAt creator { login }
  repositories(first:100) { nodes { nameWithOwner } pageInfo { hasNextPage } }
  fields(first:100) { nodes { ... on ProjectV2IterationField { name configuration {
      iterations { id title startDate duration } completedIterations { id title startDate duration }
  } } } pageInfo { hasNextPage } }
  statusUpdates(first:1) { nodes { status updatedAt } }"""
ITEMS = """query($id:ID!, $cursor:String, $sprintField:String!, $hasSprint:Boolean!) {
  node(id:$id) { ... on ProjectV2 { items(first:60, after:$cursor) {
    totalCount pageInfo { hasNextPage endCursor }
    nodes { id isArchived
      status:fieldValueByName(name:"Status"){...on ProjectV2ItemFieldSingleSelectValue{name}}
      priority:fieldValueByName(name:"Priority"){...on ProjectV2ItemFieldSingleSelectValue{name}}
      size:fieldValueByName(name:"Size"){...on ProjectV2ItemFieldSingleSelectValue{name}}
      sprint:fieldValueByName(name:$sprintField) @include(if:$hasSprint) {
        ...on ProjectV2ItemFieldIterationValue { iterationId title startDate duration }
      }
      content { __typename
        ...on Issue { number title state stateReason url repository{nameWithOwner}
          parent { number repository{nameWithOwner} } subIssues(first:1){totalCount} issueType{name}
          milestone{title url state}
        }
        ...on PullRequest { number title state url repository{nameWithOwner} milestone{title url state} }
        ...on DraftIssue { title }
      }
    }
  } } }
}"""
REPOS = """query($owner:String!,$name:String!,$cursor:String){ repository(owner:$owner,name:$name){
  nameWithOwner url latestRelease { tagName url publishedAt }
  milestones(first:100,states:OPEN,after:$cursor){totalCount pageInfo{endCursor hasNextPage}
    nodes {title url dueOn number issues(states:OPEN){totalCount} closedIssues:issues(states:CLOSED){totalCount}
      pullRequests(states:OPEN){totalCount} closedPR:pullRequests(states:[CLOSED,MERGED]){totalCount} }
  }
}}"""

def gh_json(args, payload=None, allow_sso=False):
    call = ["gh", "api", *args]
    if payload is not None:
        call.extend(["--input", "-"])
    result = subprocess.run(call, input=json.dumps(payload) if payload is not None else None,
                            text=True, encoding="utf-8", capture_output=True, timeout=90)
    try:
        value = json.loads(result.stdout)
    except ValueError:
        raise RuntimeError(f"GitHub returned no usable JSON for {args[0]} (exit {result.returncode})") from None
    errors = value.get("errors", []) if isinstance(value, dict) else []
    if result.returncode or errors:
        if allow_sso and errors and all(e.get("extensions", {}).get("saml_failure") for e in errors):
            return value.get("data"), True
        raise RuntimeError("GitHub request failed: " + "; ".join(e.get("message", "") for e in errors)[:300])
    return value, False

def graph(query, variables=None, allow_sso=False):
    value, denied = gh_json(["graphql"], {"query":query,"variables":variables or {}}, allow_sso)
    return (value if denied else value["data"]), denied

def boards(kind, owner):
    query = ("query($owner:String!,$cursor:String){ " + kind + "(login:$owner) { "
             + "projectsV2(first:30,after:$cursor) { " + PAGE + " nodes { "+BOARD_FIELDS+" } } } }")
    cursor, output, partial = None, [], False
    while True:
        data, denied = graph(query, {"owner":owner, "cursor":cursor}, allow_sso=True)
        partial |= denied
        source = (data or {}).get(kind)
        if not source:
            if denied:
                break
            raise ValueError(f"Unable to resolve {kind} {owner}")
        conn = source["projectsV2"]
        output.extend(x for x in conn["nodes"] if x)
        if not conn["pageInfo"]["hasNextPage"]:
            break
        cursor = conn["pageInfo"]["endCursor"]
    return output, partial

def period(raw):
    from datetime import date
    begin = date.fromisoformat(raw["startDate"])
    return {"id":raw.get("id") or raw["iterationId"], "name":raw["title"], "start":str(begin),
            "end":str(begin + timedelta(days=raw["duration"] - 1))}

def board_snapshot(board, owner):
    if board["fields"]["pageInfo"]["hasNextPage"] or board["repositories"]["pageInfo"]["hasNextPage"]:
        raise ValueError("A board has more than 100 fields or linked repositories")
    available = [f for f in board["fields"]["nodes"] if f and f.get("configuration")]
    field = next((f for n in ("sprint","iteration") for f in available if f["name"].lower()==n),
                 available[0] if available else None)
    periods = {}
    if field:
        for key in ("iterations","completedIterations"):
            for s in field["configuration"][key]:
                periods[s["id"]] = period(s)
    items, repos, seen = [], {r["nameWithOwner"] for r in board["repositories"]["nodes"]}, set()
    cursor = None
    while True:
        data,_ = graph(ITEMS, {"id":board["id"],"cursor":cursor,"sprintField":field["name"] if field else "Sprint",
                                "hasSprint":bool(field)})
        conn = data["node"]["items"]
        for row in conn["nodes"]:
            if row["id"] in seen:
                raise ValueError("Project membership changed during capture. Retry the snapshot.")
            seen.add(row["id"])
            c = row["content"] or {}
            repo = (c.get("repository") or {}).get("nameWithOwner")
            if repo:
                repos.add(repo)
            s = row.get("sprint")
            if s:
                periods.setdefault(s["iterationId"], period(s))
            parent = c.get("parent")
            mile = c.get("milestone") or {}
            items.append({
                "kind":c.get("__typename","Redacted"), "title":c.get("title","Restricted item"),
                "number":c.get("number"), "url":c.get("url"), "repo":repo,
                "state":c.get("state"), "reason":c.get("stateReason"),
                "status":(row.get("status") or {}).get("name"), "priority":(row.get("priority") or {}).get("name"),
                "size":(row.get("size") or {}).get("name"), "sprint":s["iterationId"] if s else None,
                "milestone":mile.get("url"), "milestoneTitle":mile.get("title"), "milestoneState":mile.get("state"),
                "rollup":bool((c.get("subIssues") or {}).get("totalCount")) or (c.get("issueType") or {}).get("name")=="Epic",
                "parent":f"{parent['repository']['nameWithOwner']}#{parent['number']}" if parent else None,
                "archived":row["isArchived"],
            })
        if not conn["pageInfo"]["hasNextPage"]:
            if len(items)!=conn["totalCount"]:
                raise ValueError("Project item count changed during capture. Retry the snapshot.")
            break
        cursor = conn["pageInfo"]["endCursor"]
    return {"key":f"{owner.lower()}-{board['number']}","name":board["title"],"owner":owner,"url":board["url"],
            "public":board["public"],"updatedAt":board["updatedAt"],"statusUpdate":next(iter(board["statusUpdates"]["nodes"]),None),
            "sprintField":field["name"] if field else None,"sprints":sorted(periods.values(),key=lambda r:(r["start"],r["name"])),
            "repos":sorted(repos),"items":items}

def repository_snapshot(slug):
    owner,name=slug.split("/",1)
    cursor, milestones = None,[]
    while True:
        data,_ = graph(REPOS,{"owner":owner,"name":name,"cursor":cursor})
        repo = data["repository"]
        if not repo:
            raise ValueError(f"Repository unavailable: {slug}")
        conn = repo["milestones"]
        for m in conn["nodes"]:
            milestones.append({"name":m["title"],"number":m["number"],"url":m["url"],"due":(m["dueOn"] or "")[:10] or None,
                              "open":m["issues"]["totalCount"]+m["pullRequests"]["totalCount"],
                              "closed":m["closedIssues"]["totalCount"]+m["closedPR"]["totalCount"]})
        if not conn["pageInfo"]["hasNextPage"]:
            if len(milestones)!=conn["totalCount"]:
                raise ValueError(f"Milestone count changed during capture in {slug}")
            return {"name":slug,"url":repo["url"],"published":repo["latestRelease"],"milestones":milestones}
        cursor=conn["pageInfo"]["endCursor"]

def main():
    SITE.mkdir(exist_ok=True)
    user,_=gh_json(["user","--jq","{login:.login}"])
    login=user["login"]
    pages,_=gh_json(["--paginate","--slurp","user/orgs?per_page=100"])
    sources=[("user",login)]+[("organization",o["login"]) for page in pages for o in page]
    projects, unavailable=[],[]
    for kind,owner in sources:
        rows,denied=boards(kind,owner)
        if denied:
            unavailable.append({"owner":owner,"reason":"Organization SSO authorization required"})
        for b in rows:
            if b["closed"] or (kind=="organization" and (b["creator"] or {}).get("login")!=login):
                continue
            p=board_snapshot(b,owner)
            projects.append(p)
            print(f"{p['name']}: {len(p['items'])} items",flush=True)
    repo_names=sorted({r for p in projects for r in p["repos"]})
    repositories={name:repository_snapshot(name) for name in repo_names}
    now=datetime.now(timezone.utc)
    snapshot={"schemaVersion":1,"capturedAt":now.isoformat(timespec="seconds"),"timezone":TZ,
              "asOf":now.astimezone(ZoneInfo(TZ)).date().isoformat(),"owner":login,
              "projects":projects,"repositories":repositories,"unavailable":unavailable}
    with tempfile.NamedTemporaryFile("w",dir=SITE,encoding="utf-8",delete=False) as stream:
        json.dump(snapshot,stream,ensure_ascii=False,separators=(",",":"))
        stream.write("\n")
        tmp=Path(stream.name)
    tmp.replace(SITE/"owner-snapshot.json")
    print(f"Wrote {len(projects)} boards, {len(repo_names)} repositories and {sum(len(p['items']) for p in projects)} items.",flush=True)

if __name__ == "__main__":
    main()

