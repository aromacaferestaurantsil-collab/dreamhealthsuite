import { createBrowserRouter } from 'react-router-dom';
import { Suspense } from 'react';
import RootLayout from '@/layouts/RootLayout';
import OwnerLayout from '@/layouts/OwnerLayout';
import PublicLayout from '@/layouts/PublicLayout';
import AppLoader from '@/components/AppLoader';
import PageSkeleton from '@/components/PageSkeleton';

// Route metadata is discovered eagerly for navigation and access filtering.
// The owner layout already eagerly imports these page modules for metadata,
// so wrapping the same modules in lazy() creates ineffective dynamic imports.
const PageLoader = () => <PageSkeleton />;
const AuthLoader = () => <AppLoader />;
const wrap = (Component) => (
  <Suspense fallback={<PageLoader />}><Component /></Suspense>
);
const authWrap = (Component) => (
  <Suspense fallback={<AuthLoader />}><Component /></Suspense>
);

const pageMods = import.meta.glob('/src/pages/**/*.jsx', { eager: true });
const pageComponent = (path) => pageMods[path]?.default;
const NotFoundPage = pageComponent('/src/pages/NotFound.jsx');

const discoveredRoutes = Object.entries(pageMods)
  .filter(([, mod]) => mod.route && mod.default)
  .map(([, mod]) => ({
    ...mod.route,
    _component: mod.default,
  }));

function buildDiscoveredRoute(r) {
  const isIndex = r.path === '/';
  const config = {
    element: wrap(r._component),
    handle: { access: r.access ?? (r.layout === 'owner' ? 'authenticated' : 'public') },
  };
  if (isIndex) config.index = true;
  else config.path = r.path.replace(/^\//, '');
  return config;
}

const AuthPage = pageComponent('/src/pages/auth/AuthPage.jsx');
const AuthCallback = pageComponent('/src/pages/auth/Callback.jsx');
const AuthError = pageComponent('/src/pages/auth/ErrorPage.jsx');
const AuthAccessDenied = pageComponent('/src/pages/auth/AccessDenied.jsx');
const AuthResetPassword = pageComponent('/src/pages/auth/ResetPassword.jsx');
const AuthForgotPassword = pageComponent('/src/pages/auth/ForgotPassword.jsx');
const AuthPromptPassword = pageComponent('/src/pages/auth/PromptPassword.jsx');
const AuthEmailVerification = pageComponent('/src/pages/auth/EmailVerification.jsx');
const AuthAcceptInvitation = pageComponent('/src/pages/auth/AcceptInvitation.jsx');

function buildAuthRoutes() {
  const routes = [];
  const loginEl = (
    <Suspense fallback={<AuthLoader />}><AuthPage mode="login" /></Suspense>
  );
  const signupEl = (
    <Suspense fallback={<AuthLoader />}><AuthPage mode="signup" /></Suspense>
  );

  routes.push(
    { path: 'login', element: loginEl, handle: { access: 'public' } },
    { path: 'signup', element: signupEl, handle: { access: 'public' } },
    { path: ':profile/login', element: loginEl, handle: { access: 'public' } },
    { path: ':profile/signup', element: signupEl, handle: { access: 'public' } },
  );

  routes.push(
    { path: 'callback', element: authWrap(AuthCallback), handle: { access: 'public' } },
    { path: 'access-denied', element: authWrap(AuthAccessDenied), handle: { access: 'public' } },
    { path: 'error', element: authWrap(AuthError), handle: { access: 'public' } },
    { path: 'forgot-password', element: authWrap(AuthForgotPassword), handle: { access: 'public' } },
    { path: 'reset-password', element: authWrap(AuthResetPassword), handle: { access: 'public' } },
    { path: 'reset-password/:appId/:fields', element: authWrap(AuthResetPassword), handle: { access: 'public' } },
    { path: 'prompt-password/:appId/:emailAddress/:provider', element: authWrap(AuthPromptPassword), handle: { access: 'public' } },
    { path: 'verify-email', element: authWrap(AuthEmailVerification), handle: { access: 'public' } },
    { path: 'accept-invite', element: authWrap(AuthAcceptInvitation), handle: { access: 'public' } },
  );
  return routes;
}

const ownerRoutes = discoveredRoutes.filter((r) => r.layout === 'owner').map(buildDiscoveredRoute);
const publicRoutes = [
  ...discoveredRoutes.filter((r) => r.layout === 'public').map(buildDiscoveredRoute),
  ...buildAuthRoutes(),
];

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { element: <OwnerLayout />, children: [...ownerRoutes] },
      { element: <PublicLayout />, children: [...publicRoutes] },
      { path: '*', element: wrap(NotFoundPage) },
    ],
  },
], { basename: import.meta.env.BASE_URL });
