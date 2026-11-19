# Standalone platform capability implementation

This document maps the requested Apper capabilities to the HealthSuite 360 standalone architecture. It distinguishes repository implementation from infrastructure that must be configured later.

| Capability | Buildable without Apper | HealthSuite implementation | Current status / gate |
|---|---|---|---|
| Table- and field-level security | Yes | PostgreSQL grants + RLS + restricted views + authenticated RPC/Edge Function validation. Sensitive columns are excluded from broad views and returned only through purpose-specific queries. | Existing tenant RLS foundation; reconstructed module tables added in branch migration. Requires negative cross-tenant/role tests. |
| Built-in roles and team management | Yes | Tenant memberships, role-to-profile mapping, branch-scoped membership, invitation lifecycle, owner-protected admin changes. | Core membership model exists. Invitation lifecycle and branch role tests remain. |
| Edge Functions for integrations | Yes | Deno/Supabase Edge Functions; validate JWT, tenant entitlement, input schema, idempotency and audit before provider calls. | Existing platform-control and license-portal functions; other integrations are adapters to build. |
| Payment integration | Yes | Provider-neutral payment intent service, gateway-specific adapter, signed webhook verification, idempotent event ledger and reconciliation. Never trust browser success callbacks. | Not connected to a gateway. Select provider and configure owner-held secrets only when implementation is ready. |
| Custom domains | Yes | Static hosting + DNS CNAME/A records + TLS + Supabase Auth redirect allow-list. | Deferred until web/PWA completion and final test phase. No DNS changes made. |
| Multi-region backups | Yes, with additional infrastructure | Automated primary backups, encrypted off-site object-storage copies in a second region/account, retention policy, checksums and scheduled restore drills. | Design only. Requires storage/egress budget approval before provisioning. |
| Zapier / Integrately / Make / n8n / Pabbly | Yes | Tenant-scoped outbound webhooks, signed inbound webhook receiver, retry queue, delivery log and provider-specific OAuth/API connectors. | Architecture supported; provider connectors and per-tenant credentials remain to build. |
| API for every app | Yes | Versioned REST API under `/api/v1`, OpenAPI 3.1 contract, JWT auth, tenant context, pagination, idempotency and standard error envelope. | OpenAPI contract is being added; server endpoints must be implemented and contract-tested. |
| Users connect their own accounts | Yes | OAuth authorization-code + PKCE, state/nonce validation, encrypted refresh tokens in server-only storage, scoped permissions, disconnect/revoke and per-tenant integration settings. | No OAuth providers connected; no tokens stored. |
| SVG support | Yes | Upload allow-list, size limits, SVG sanitisation removing scripts/events/foreignObject/external references, safe raster preview where appropriate, private storage and signed URLs. | Upload pipeline not yet enabled; do not render raw untrusted SVG inline. |
| Separate production and development databases | Yes | Independent Supabase projects, Auth settings, Storage buckets, keys and redirect URLs. No shared service-role secrets. | Production project is protected; a free isolated dev database is not yet available. No paid branch created. |

## Security implementation contract

- Browser code may contain only Supabase URL and publishable key.
- Service-role keys, gateway secrets, OAuth client secrets and signing keys remain in Edge Function secrets.
- RLS is the final data boundary; hiding UI controls is not authorization.
- Every query and RPC must be scoped to the authenticated tenant and branch.
- Clinical, prescription, payment and employee records require purpose-limited access and audit.
- Webhook endpoints verify provider signatures against the raw request body and reject replayed event IDs.
- OAuth tokens are encrypted at rest, never returned to the browser, and revocable by the tenant owner.
- Integration retries use idempotency keys and exponential backoff; failures are visible in an operations log.
- Exports are permission-checked, tenant-scoped and audited. CSV is spreadsheet-friendly; PDF is generated from a controlled report view.
- SVG files are untrusted input. Sanitise before preview; force download or rasterise if sanitisation cannot be guaranteed.

## Payment and accounting rules

- Payment intent, provider event, payment allocation, refund and settlement are separate records.
- A client-side "payment successful" message is not proof of payment.
- Only a verified webhook or a trusted manual cash/UPI collection entry may mark an invoice paid.
- Reconciliation compares gateway settlement, fees, refunds and bank settlement; unmatched items remain exceptions.
- Expense payment records must reconcile to the expense total; partial payments retain an outstanding balance.
- Distributor creditor balances derive from purchase receipts and supplier payments/credit notes, not from purchase-order totals alone.

## Backup and recovery rules

- Backups must be encrypted, access-controlled, versioned and stored outside the primary region/account.
- Define RPO/RTO per subscription tier and test restores into an isolated environment.
- A backup is not verified until a restore and integrity check succeeds.
- Do not create a second-region bucket or paid backup service without an explicit budget approval.
