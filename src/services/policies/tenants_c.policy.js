const ROOT_PROFILE = 'Admin_c';

export const select = (record, user) => user?.profile === ROOT_PROFILE;
export const insert = (record, user) => user?.profile === ROOT_PROFILE;
export const update = (record, user) => user?.profile === ROOT_PROFILE;
export const remove = (record, user) => user?.profile === ROOT_PROFILE;