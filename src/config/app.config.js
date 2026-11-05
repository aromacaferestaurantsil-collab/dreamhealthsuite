export const APP_CONFIG = {
  appName: 'HealthSuite 360',
  appTagline: 'One connected workspace for healthcare operations',
  logo: '',
  primaryColor: '#A52A6F',
  defaultLoginRoute: '/super-admin/login',
  redirectAfterAuth: '/'
};

export const AUTH_PROFILES = [
  {
    key: 'super-admin',
    name: 'Super Admin',
    description: 'Platform owner and global operations',
    redirectAfterAuth: '/',
    hasSignup: false
  },
  {
    key: 'tenant-admin',
    name: 'Business Owner',
    description: 'Pharmacy, laboratory, clinic and healthcare business owners',
    redirectAfterAuth: '/',
    hasSignup: true
  },
  {
    key: 'staff',
    name: 'Staff Member',
    description: 'Authorised team members',
    redirectAfterAuth: '/',
    hasSignup: false
  }
];

export const GENERIC_AUTH = {
  enabled: true,
  allowSignup: false
};