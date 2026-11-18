const configUrl = 'https://raw.githubusercontent.com/theharithsa/project-atlas/main/config/owners.json';
export const settingsRefreshSeconds = 300;

export function parseOwners(config) {
  const kinds = {users: 'users', organizations: 'orgs'};
  if (!config || typeof config !== 'object' || Array.isArray(config) ||
      Object.keys(config).some(key => !Object.hasOwn(kinds, key)))
    throw new Error('Expected users and organizations in owner settings');
  const owners = new Map();
  for (const [key, kind] of Object.entries(kinds)) {
    if (!Array.isArray(config[key])) throw new Error(key + ' must be an array of GitHub logins');
    for (const account of config[key]) {
      if (typeof account !== 'string' || account.length > 39 ||
          !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(account))
        throw new Error('Invalid GitHub login in ' + key);
      const id = account.toLowerCase();
      if (owners.has(id)) {
        if (owners.get(id).kind !== kind) throw new Error('A login can have only one owner type');
      } else {
        owners.set(id, {account, kind});
      }
    }
  }
  return [...owners.values()];
}

export function createOwnerSettings(readConfig, clock = Date.now) {
  let last;
  return async () => {
    const age = last ? clock() - last.checkedAt : Infinity;
    if (age < settingsRefreshSeconds * 1000) return {owners: last.owners, stale: false};
    try {
      const owners = parseOwners(await readConfig());
      last = {owners, checkedAt: clock()};
      return {owners, stale: false};
    } catch (error) {
      if (!last || clock() - last.checkedAt >= 2 * settingsRefreshSeconds * 1000) throw error;
      return {owners: last.owners, stale: true};
    }
  };
}

export const publishedOwnerSettings = createOwnerSettings(async () => {
  const response = await fetch(configUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Published owner settings unavailable');
  return response.json();
});
