export const APP_CONFIG = {
  name: 'HealthSuite 360',
  tagline: 'One connected workspace for healthcare operations',
  emoji: '⚕️',
  icon: 'Stethoscope',
  defaultTheme: 'system',
  defaultLoginRoute: '/super-admin/login'
};

export const AUTH_PROFILES = [
  {
    key: 'super-admin',
    name: 'Admin_c',
    profileSlug: "|AGL0D0zG3j5ZL90pf5WyTp85z0NTHx20CaXaBULon2Q=",
    redirectAfterAuth: '/',
    authPage: {
      loginTitle: 'Super Admin Sign In',
      signupTitle: 'Create Super Admin Account',
      loginDescription: null,
      signupDescription: null,
    },
    altLinksLeadIn: 'Go to the right portal',
    altLinks: [

    ],
    reportsTo: null,
    hasSignup: false,
  }
];

export const GENERIC_AUTH = {
  loginTitle: 'Welcome to HealthSuite 360',
  signupTitle: 'Create a HealthSuite account',
  loginDescription: 'Secure access to healthcare operations.',
  signupDescription: 'Ask your platform administrator for an invitation.',
  redirectAfterAuth: '/'
};