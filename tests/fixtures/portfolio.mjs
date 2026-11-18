export function samplePortfolio(now = new Date('2026-11-18T08:00:00Z')) {
  const date = (offset) => new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  const names = ['Field Notes', 'Pocket Ledger', 'Relay'];
  const repositories = {};
  const projects = names.map((name, index) => {
    const slug = 'atlas-example/' + name.toLowerCase().replaceAll(' ', '-');
    const url = 'https://github.com/' + slug;
    const milestone = {name:'v1.' + (index + 2) + '.0', number:1, url:url + '/milestone/1', due:date(6 + index * 5), open:3, closed:index + 2};
    repositories[slug] = {name:slug, url, milestones:[milestone], published:null};
    const windows = [-8, 6, 20].map((offset, i) => ({
      id:'s' + (i + 1), name:'Sprint ' + (i + 1), start:date(offset), end:date(offset + 13),
    }));
    const titles = ['Add a compact summary', 'Review keyboard navigation', 'Publish the release notes', 'Document export settings', 'Improve search results', 'Verify the daily summary'];
    const items = titles.map((title, i) => ({
      kind:'Issue', title, number:i + 1, url:url + '/issues/' + (i + 1), repo:slug,
      state:i === 0 ? 'CLOSED' : 'OPEN', reason:null, status:['Done','In progress','Planned','Backlog','Planned','Ready'][i],
      priority:i < 3 ? 'P1' : 'P2', size:null, sprint:i < 3 ? 's1' : i === 4 ? 's2' : null,
      milestone:i === 3 ? null : milestone.url, milestoneTitle:i === 3 ? null : milestone.name,
      milestoneState:i === 3 ? null : 'OPEN', rollup:false, parent:null, archived:false,
    }));
    return {key:'atlas-example-' + (index + 1), name, owner:'atlas-example',
      url:'https://github.com/users/atlas-example/projects/' + (index + 1), public:true, updatedAt:now.toISOString(),
      statusUpdate:null, sprintField:'Sprint', sprints:windows, repos:[slug], items};
  });
  return {schemaVersion:1, capturedAt:now.toISOString(), timezone:'Asia/Kolkata', asOf:date(0),
    owner:'atlas-example', projects, repositories, unavailable:[], boardRefreshSeconds:60, repositoryRefreshSeconds:180};
}
