"""Validate the Atlas catalog and the files eligible for source and hosting publication."""
from pathlib import Path, PurePosixPath
import re
import subprocess
from schema_validation import load_json, validate_record
from skill_catalog import validate_catalog

ROOT = Path(__file__).resolve().parents[1]
SECRETS = (re.compile(rb"-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----"),
           re.compile(rb"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
           re.compile(rb"\bgithub_pat_[A-Za-z0-9_]{50,}\b"))


def check(root):
    project = load_json(root / "project.json")
    errors = validate_record(root, "project", project) + validate_catalog(root)
    if project["template"]["version"] != (root / "TEMPLATE_VERSION").read_text(encoding="utf-8").strip():
        errors.append("Template provenance version differs from TEMPLATE_VERSION")
    if not re.fullmatch(r"[a-f0-9]{40}", project["template"]["revision"] or ""):
        errors.append("Record the exact source template revision")
    records = subprocess.check_output(["git", "ls-files", "-z"], cwd=root)
    for entry in records.decode("utf-8").split("\0"):
        if not entry:
            continue
        path = PurePosixPath(entry)
        if ({"local-archive", ".firebase", "node_modules"} & set(path.parts)
                or path.name in {".env", "owner-snapshot.json", "firebase-debug.log"}
                or (path.name.startswith(".env.") and path.name != ".env.example")
                or path.match("*-firebase-adminsdk-*.json")
                or path.suffix in {".pem", ".key"}):
            errors.append(f"Local or sensitive file staged for publication: {entry}")
            continue
        if path.parts[0] == "site" and path.suffix not in {".html", ".js", ".css", ".svg", ".ttf", ".txt"}:
            errors.append(f"Review the Hosting asset allowlist before publishing {entry}")
        local = root / entry
        if local.is_file() and path.suffix not in {".jpg", ".ttf"}:
            if any(pattern.search(local.read_bytes()) for pattern in SECRETS):
                errors.append(f"Credential material in {entry}")
    return errors


if __name__ == "__main__":
    errors = check(ROOT)
    for error in errors:
        print(error)
    if errors:
        raise SystemExit(1)
    print("Template provenance, service catalog and publication checks passed.")
