import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '@/lib/supabase';
import { setUser, clearUser, setInitialized } from '@/store/userSlice';
import { verifyRouteAccess } from '@/router/route.utils';
import { APP_CONFIG } from '@/config/app.config';
import AppLoader from '@/components/AppLoader';
import { ErrorBoundary } from '@/components/ui/error-boundary';

const AuthContext = createContext(null);
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within RootLayout');
  return ctx;
}
export function useTenant() {
  const { memberships, activeTenant, setActiveTenant } = useAuth();
  return { memberships, activeTenant, setActiveTenant };
}
const roleProfiles = {
  owner: 'Admin_c', admin: 'Admin_c', manager: 'Manager',
  doctor: 'Doctor', pharmacist: 'Pharmacist', lab_technician: 'LabTechnician',
  pathologist: 'Pathologist', care_worker: 'CareWorker', receptionist: 'Receptionist',
  analyst: 'Analyst', staff: 'Staff',
};

export default function RootLayout() {
  const dispatch = useDispatch();
  const { user, isAuthenticated, isInitialized } = useSelector(state => state.user);
  const [memberships,setMemberships] = useState([]);
  const [activeTenantId,setActiveTenantId] = useState('');
  const [authReady,setAuthReady] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const matches = useMatches();

  useEffect(() => {
    if (!supabase) { dispatch(setInitialized()); setAuthReady(true); return; }
    let alive = true;
    const load = async sessionUser => {
      if (!sessionUser) {
        if (!alive) return;
        setMemberships([]); setActiveTenantId(''); dispatch(clearUser()); setAuthReady(true); return;
      }
      const { data, error } = await supabase.from('tenant_memberships')
        .select('id,tenant_id,branch_id,role,status,tenants(id,display_name,slug,status)')
        .eq('user_id',sessionUser.id).eq('status','active');
      if (error) throw error;
      if (!alive) return;
      const rows = data ?? [];
      setMemberships(rows);
      setActiveTenantId(current => rows.some(m=>m.tenant_id===current) ? current : (rows[0]?.tenant_id ?? ''));
      const selected = rows[0];
      dispatch(setUser({
        id: sessionUser.id, emailAddress: sessionUser.email,
        firstName: sessionUser.user_metadata?.full_name?.split(' ')[0] ?? '',
        lastName: sessionUser.user_metadata?.full_name?.split(' ').slice(1).join(' ') ?? '',
        profile: selected ? (roleProfiles[selected.role] ?? 'Staff') : 'NoTenant',
        role: selected?.role ?? null,
      }));
      setAuthReady(true);
    };
    supabase.auth.getSession().then(({data,error}) => {
      if (error) throw error;
      return load(data.session?.user ?? null);
    }).catch(() => { if (alive) { dispatch(clearUser()); setAuthReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event,session) => {
      Promise.resolve().then(()=>load(session?.user ?? null)).catch(()=>{ if(alive){setMemberships([]);dispatch(clearUser());setAuthReady(true);} });
    });
    return () => { alive=false; listener.subscription.unsubscribe(); };
  },[dispatch]);

  const setActiveTenant = tenantId => {
    if (memberships.some(m=>m.tenant_id===tenantId)) {
      setActiveTenantId(tenantId);
      const selected=memberships.find(m=>m.tenant_id===tenantId);
      dispatch(setUser({...user,profile:roleProfiles[selected.role]??'Staff',role:selected.role}));
    }
  };
  const activeTenant = useMemo(()=>memberships.find(m=>m.tenant_id===activeTenantId)??null,[memberships,activeTenantId]);
  const deepestMatch = matches[matches.length-1];
  const accessRule = deepestMatch?.handle?.access ?? 'public';
  const allowed = authReady && isInitialized && verifyRouteAccess(accessRule,user);

  useEffect(()=>{
    if(!authReady || !isInitialized) return;
    if(!allowed) {
      if(user) navigate('/access-denied',{replace:true});
      else navigate(`${APP_CONFIG.defaultLoginRoute??'/login'}?redirect=${encodeURIComponent(location.pathname+location.search)}`,{replace:true});
    }
  },[location.pathname,authReady,isInitialized,allowed,user,navigate]);

  const handleLogout = async () => {
    if(supabase) await supabase.auth.signOut();
    setMemberships([]); setActiveTenantId(''); dispatch(clearUser());
    navigate(APP_CONFIG.defaultLoginRoute??'/login',{replace:true});
  };
  if(!authReady || !isInitialized || !allowed) return <AppLoader fullScreen />;
  return (
    <AuthContext.Provider value={{logout:handleLogout,user,isAuthenticated,memberships,activeTenant,setActiveTenant}}>
      <ErrorBoundary fullPage><Outlet /></ErrorBoundary>
    </AuthContext.Provider>
  );
}
