import ModuleWorkspace from './ModuleWorkspace';
export const route = { path: '/doctors', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Stethoscope', label: 'DoctorSuite', order: 12, profiles: null };
export default ModuleWorkspace;