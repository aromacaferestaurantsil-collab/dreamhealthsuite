import DemoPortal from '@/components/DemoPortal';
export const route = { path: '/preview/vendor', layout: 'public', access: 'public' };
export default function VendorPreview() { return <DemoPortal kind="vendor" />; }
