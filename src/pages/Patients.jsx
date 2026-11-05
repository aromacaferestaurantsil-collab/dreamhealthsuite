import ModuleWorkspace from './ModuleWorkspace';
export const route = { path: '/patients', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'HeartPulse', label: 'PatientSuite', order: 13, profiles: null };
export default ModuleWorkspace;