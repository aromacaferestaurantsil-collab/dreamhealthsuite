import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { supabase, requireSupabase } from '@/lib/supabase';
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
const moduleRouteRules = [
  { match: /^\/pharmacy\/pos$/, key: 'pharmacy_suite', roles: ['owner','admin','pharmacist'] },
  { match: /^\/team-members$/, key: null, roles: ['owner','admin','manager'] },
  { match: /^\/pharmacy(?:\/|$)|^\/pharmacy-workflows$/, key: 'pharmacy_suite', roles: ['owner','admin','manager','pharmacist'] },
  { match: /^\/laboratory(?:\/|$)/, key: 'laboratory_suite', roles: ['owner','admin','manager','pathologist','lab_technician'] },
  { match: /^\/doctors?(?:\/|$)/, key: 'doctor_suite', roles: ['owner','admin','manager','doctor','receptionist'] },
  { match: /^\/patients?(?:\/|$)/, key: 'patient_suite', roles: ['owner','admin','manager','receptionist','doctor','pharmacist','lab_technician','pathologist'] },
  { match: /^\/care-connect(?:\/|$)/, key: 'care_connect', roles: ['owner','admin','manager','care_worker'] },
  { match: /^\/analytics(?:\/|$)/, key: 'analytics', roles: ['owner','admin','analyst'] },
];

export default function RootLayout() {
  const dispatch = useDispatch();
  const { user, isAuthenticated, isInitialized } = useSelector(state => state.user);
  const [memberships,setMemberships] = useState([]);
  const [activeTenantId,setActiveTenantId] = useState('');
  const [authReady,setAuthReady] = useState(false);
  const [moduleAccess,setModuleAccess] = useState({status:'idle',tenantId:'',keys:[]});
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
  useEffect(() => {
    if (user && (location.pathname === '/login' || location.pathname === '/signup' || location.pathname.endsWith('/login') || location.pathname.endsWith('/signup'))) navigate('/', { replace: true });
    else if (user && user.profile === 'NoTenant' && location.pathname !== '/workspace/new' && location.pathname !== '/pharmacy-order' && location.pathname !== '/demo-workspace' && location.pathname !== '/accept-invite') navigate('/workspace/new', { replace: true });
    else if (user && user.profile !== 'NoTenant' && location.pathname === '/workspace/new') navigate('/', { replace: true });
  }, [user, location.pathname, navigate]);

  const routeRule = moduleRouteRules.find(rule => rule.match.test(location.pathname));
  useEffect(() => {
    let alive = true;
    async function checkModuleAccess() {
      if (!activeTenant?.tenant_id || !user) {
        if (alive) setModuleAccess({status:'not-required',tenantId:activeTenant?.tenant_id??'',keys:[]});
        return;
      }
      setModuleAccess({status:'loading',tenantId:activeTenant.tenant_id,keys:[]});
      try {
        const {data,error}=await requireSupabase().rpc('get_my_module_entitlements',{p_tenant_id:activeTenant.tenant_id});
        if(error) throw error;
        if(alive) setModuleAccess({status:'ready',tenantId:activeTenant.tenant_id,keys:(data??[]).filter(row=>row.enabled).map(row=>row.module_key)});
      } catch(error) {
        if(alive) setModuleAccess({status:'error',tenantId:activeTenant.tenant_id,keys:[],message:error.message});
      }
    }
    checkModuleAccess();
    return ()=>{alive=false;};
  },[activeTenant?.tenant_id,user?.id]);

  const deepestMatch = matches[matches.length-1];
  const accessRule = deepestMatch?.handle?.access ?? 'public';
  const baseAllowed = authReady && isInitialized && verifyRouteAccess(accessRule,user);
  const roleAllowed = !routeRule || routeRule.roles.includes(activeTenant?.role);
  const moduleKeyAliases = {
    pharmacy_suite:['pharmacy_suite','pharmacy'],
    laboratory_suite:['laboratory_suite','lab_suite','laboratory','lab'],
    doctor_suite:['doctor_suite','doctor','doctors'],
    patient_suite:['patient_suite','patient','patients'],
    care_connect:['care_connect','care','careconnect'],
    analytics:['analytics','health_analytics'],
  };
  const entitlementAllowed = !routeRule || !routeRule.key || (moduleAccess.status==='ready' && moduleAccess.tenantId===activeTenant?.tenant_id && moduleKeyAliases[routeRule.key].some(key=>moduleAccess.keys.includes(key)));
  const moduleCheckPending = !!routeRule?.key && ['idle','loading'].includes(moduleAccess.status);
  const allowed = baseAllowed && roleAllowed && entitlementAllowed && !moduleCheckPending;

  useEffect(()=>{
    if(!authReady || !isInitialized || !baseAllowed) return;
    if(routeRule && moduleCheckPending) return;
    if(!allowed) {
      if(user) navigate('/access-denied',{replace:true});
      else navigate(`${APP_CONFIG.defaultLoginRoute??'/login'}?redirect=${encodeURIComponent(location.pathname+location.search)}`,{replace:true});
    }
  },[location.pathname,authReady,isInitialized,baseAllowed,allowed,routeRule?.key,moduleCheckPending,user,navigate]);

  const handleLogout = async () => {
    if(supabase) await supabase.auth.signOut();
    setMemberships([]); setActiveTenantId(''); dispatch(clearUser());
    navigate(APP_CONFIG.defaultLoginRoute??'/login',{replace:true});
  };
  if(!authReady || !isInitialized || !allowed) return <AppLoader fullScreen />;
  return (
    <AuthContext.Provider value={{logout:handleLogout,user,isAuthenticated,memberships,activeTenant,setActiveTenant,moduleAccess}}>
      <ErrorBoundary fullPage><Outlet /></ErrorBoundary>
    </AuthContext.Provider>
  );
}
