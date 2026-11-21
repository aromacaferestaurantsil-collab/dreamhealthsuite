import DemoPortal from '@/components/DemoPortal';
export const route = { path: '/preview/doctor', layout: 'public', access: 'public' };
export default function DoctorPreview() { return <DemoPortal kind="doctor" />; }
