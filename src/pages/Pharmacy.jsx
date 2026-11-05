import ModuleWorkspace from './ModuleWorkspace';
export const route = { path: '/pharmacy', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Pill', label: 'PharmaSuite', order: 10, profiles: null };
export default ModuleWorkspace;