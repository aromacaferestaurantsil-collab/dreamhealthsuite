import DemoPortal from '@/components/DemoPortal';
export const route = { path: '/preview/patient', layout: 'public', access: 'public' };
export default function PatientPreview() { return <DemoPortal kind="patient" />; }
