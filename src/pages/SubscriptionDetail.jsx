import { Navigate,useParams } from 'react-router-dom';
export const route={path:'/subscriptions/:id',layout:'owner',access:'authenticated'};
export default function SubscriptionDetail(){const {id}=useParams();return <Navigate to="/subscriptions" replace state={{requestedSubscription:id}}/>;}