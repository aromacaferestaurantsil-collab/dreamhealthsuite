import DemoPortal from '@/components/DemoPortal';
export const route = { path: '/preview/agent', layout: 'public', access: 'public' };
export default function AgentPreview() { return <DemoPortal kind="agent" />; }
