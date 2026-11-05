import ModuleWorkspace from './ModuleWorkspace';
export const route = { path: '/laboratory', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Microscope', label: 'LabSuite', order: 11, profiles: null };
export default ModuleWorkspace;