// The browser stores owner selections. Each network request identifies one public owner.
export const preferencesKey = 'project-atlas.portfolio.v1';
export const maxPersonalOwners = 12;

export function ownerLists(users, organizations) {
  const seen = new Map();
  function parse(input, kind) {
    if (typeof input !== 'string' || input.length > 2000) throw new Error('Enter GitHub logins separated by commas.');
    const list = [];
    for (const login of input.trim().split(/[\s,]+/).filter(Boolean)) {
      if (login.length > 39 || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(login))
        throw new Error('Use GitHub logins such as octocat, without @ or a URL.');
      const key = login.toLowerCase();
      if (seen.has(key) && seen.get(key) !== kind) throw new Error('Put each login in either Users or Organizations.');
      if (!seen.has(key)) list.push(login);
      seen.set(key, kind);
    }
    return list;
  }
  const result = {users: parse(users, 'users'), organizations: parse(organizations, 'orgs')};
  if (seen.size > maxPersonalOwners) throw new Error('Choose up to ' + maxPersonalOwners + ' owners.');
  return result;
}

export function readPreferences(read = () => window.localStorage.getItem(preferencesKey)) {
  const initial = {mode: 'shared', users: [], organizations: []};
  try {
    const value = JSON.parse(read());
    if (!value || !['shared', 'personal'].includes(value.mode)) return initial;
    for (const list of [value.users, value.organizations]) {
      if (!Array.isArray(list) || list.length > maxPersonalOwners || !list.every(item => typeof item === 'string' && item.length <= 39)) return initial;
    }
    return {mode: value.mode, ...ownerLists(value.users.join(','), value.organizations.join(','))};
  } catch {
    return initial;
  }
}

export function writePreferences(value, write = text => window.localStorage.setItem(preferencesKey, text)) {
  try { write(JSON.stringify(value)); return true; }
  catch { return false; }
}

export async function fetchSnapshot(path, signal) {
  const response = await fetch(path, {cache:'no-cache', signal: AbortSignal.any([signal, AbortSignal.timeout(55_000)])});
  if (!response.ok) {
    const error = new Error('Public feed unavailable');
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function personalPortfolio(settings, signal, read = fetchSnapshot) {
  const owners = [
    ...settings.users.map(account => ({account, kind: 'users'})),
    ...settings.organizations.map(account => ({account, kind: 'orgs'})),
  ];
  const snapshots = [], unavailable = [];
  const queue = owners.values();
  async function worker() {
    for (const {account, kind} of queue) {
      signal.throwIfAborted();
      const login = account.toLowerCase();
      try {
        const snapshot = await read('/api/v1/owners/' + kind + '/' + login, signal);
        if (snapshot.schemaVersion !== 1 || snapshot.directoryOwners?.length !== 1 ||
            snapshot.directoryOwners[0].toLowerCase() !== login || !Array.isArray(snapshot.projects) ||
            !snapshot.projects.every(project => project.public && project.owner.toLowerCase() === login))
          throw new Error('Unexpected owner feed');
        snapshots.push(snapshot);
      } catch (error) {
        signal.throwIfAborted();
        unavailable.push({owner:account, reason:error.status === 404 ? 'Public owner directory not found for this account type' : 'Public owner feed temporarily unavailable'});
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(2, owners.length)}, worker));
  if (owners.length && !snapshots.length) {
    const error = new Error('Personal portfolio unavailable');
    error.unavailable = unavailable;
    throw error;
  }
  // Keep the oldest successful check as the portfolio freshness timestamp.
  snapshots.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.owner.localeCompare(b.owner));
  const first = snapshots[0];
  const now = new Date();
  const projects = new Map();
  const repositories = new Map();
  const warnings = new Map();
  for (const snapshot of snapshots) {
    for (const project of snapshot.projects) projects.set(project.key, project);
    for (const [slug, repo] of Object.entries(snapshot.repositories)) {
      if (!repositories.has(slug) || repositories.get(slug).capturedAt < repo.capturedAt) repositories.set(slug, repo);
    }
    unavailable.push(...snapshot.unavailable);
  }
  for (const warning of unavailable) {
    if (!repositories.has(warning.owner)) warnings.set(warning.owner + '/' + warning.reason, warning);
  }
  return {
    schemaVersion:1, timezone:'Asia/Kolkata', capturedAt:first?.capturedAt || now.toISOString(),
    asOf:first?.asOf || new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),
    directoryOwners:owners.map(o => o.account), directoryRefreshSeconds:600,
    boardRefreshSeconds:60, repositoryRefreshSeconds:180,
    projects:[...projects.values()].sort((a,b) => a.key.localeCompare(b.key)),
    repositories:Object.fromEntries([...repositories].sort(([a],[b]) => a.localeCompare(b))),
    unavailable:[...warnings.values()].sort((a,b) => a.owner.localeCompare(b.owner)),
  };
}
