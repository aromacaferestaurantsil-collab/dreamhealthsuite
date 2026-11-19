import { Navigate } from 'react-router-dom';
export const route={path:'/subscriptions/new',layout:'owner',access:'authenticated'};
export default function SubscriptionNew(){return <Navigate to="/subscriptions" replace/>;}