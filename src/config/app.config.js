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
    label: 'Super Admin',
    profileSlug: '',
    redirectAfterAuth: '/',
    hasSignup: false,
    reportsTo: null,
    authPage: {
      loginTitle: 'HealthSuite 360',
      signupTitle: 'Super Admin access',
      loginDescription: 'Sign in to manage the healthcare platform.',
      signupDescription: 'Super Admin accounts are created by the platform owner.'
    },
    altLinksLeadIn: 'Platform access',
    altLinks: []
  }
];

export const GENERIC_AUTH = {
  loginTitle: 'Welcome to HealthSuite 360',
  signupTitle: 'Create a HealthSuite account',
  loginDescription: 'Secure access to healthcare operations.',
  signupDescription: 'Ask your platform administrator for an invitation.',
  redirectAfterAuth: '/'
};