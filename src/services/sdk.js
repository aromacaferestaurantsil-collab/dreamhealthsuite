/**
 * Temporary migration guard for screens not yet ported from the former hosted data SDK.
 * This module deliberately has no dependency on Apper or any browser-injected global.
 * Replace each caller with a tenant-scoped Supabase query, then delete this file.
 */
const migrationError = () => new Error(
  'This screen is being migrated to the HealthSuite database. Its former hosted data connector is disabled.'
);

export const sdk = Object.freeze({
  table() {
    throw migrationError();
  },
});

export const demoAccounts = [];
