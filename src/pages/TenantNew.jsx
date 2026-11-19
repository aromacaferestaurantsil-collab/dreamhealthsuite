import { Navigate } from 'react-router-dom';
export const route={path:'/tenants/new',layout:'owner',access:'authenticated'};
export default function TenantNew(){return <Navigate to="/workspace/new" replace/>;}