import DemoPortal from '@/components/DemoPortal';
export const route = { path: '/preview/super-admin', layout: 'public', access: 'public' };
export default function AdminPreview() { return <DemoPortal kind="admin" />; }
