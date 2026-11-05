const ROOT_PROFILES = ['Super Admin'];
const OWNER_PROFILES = ['Super Admin', 'Business Owner'];

function profile(user) {
  return user?.profile?.name ?? user?.accounts?.[0]?.profile?.name ?? '';
}

export const select = (record, user) => ROOT_PROFILES.includes(profile(user)) || OWNER_PROFILES.includes(profile(user));
export const insert = (record, user) => ROOT_PROFILES.includes(profile(user));
export const update = (record, user) => ROOT_PROFILES.includes(profile(user));
export const remove = (record, user) => ROOT_PROFILES.includes(profile(user));