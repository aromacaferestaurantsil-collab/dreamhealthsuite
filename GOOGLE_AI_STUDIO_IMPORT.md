# PharmaSuite prototype — Google AI Studio import

## Source baseline
- Repository: `aromacaferestaurantsil-collab/dreamhealthsuite`
- Import branch: `feature/pharmasuite-ai-studio-import`
- Baseline commit: `69c40facb1f0994e52d118951c8ca28e9b907a21`
- This branch is isolated from `master` and from the deployment-readiness branch.

## Import into Google AI Studio
1. Open Google AI Studio Build mode: https://aistudio.google.com/
2. Choose the GitHub import option and connect the GitHub account that can access this repository.
3. Select `aromacaferestaurantsil-collab/dreamhealthsuite`.
4. Select branch `feature/pharmasuite-ai-studio-import` (do not import `master`).
5. Import the existing React/Vite application. Keep the existing project structure; do not regenerate it as a new starter app.
6. Preserve Supabase as the application database/auth layer. Do not silently replace it with Firebase/Firestore.
7. Keep all service-role keys, payment secrets and other credentials server-side. Never commit secrets or put privileged keys in Vite client variables.

## What this prototype contains
PharmaSuite is part of the HealthSuite 360 React/Vite application. Relevant screens include:
- Pharmacy inventory and medicine catalogue
- Pharmacy POS and sales
- Purchase and goods receiving
- Stock control and batch/expiry management
- Finance and supplier payments
- Operations and workflow workspace
- Customer order portal
- Growth, intelligence and settings workspaces

The app is a responsive web/PWA foundation. It is not yet a native Android project and importing it into AI Studio does not itself produce an APK. Android packaging is a separate Capacitor wrapper/build stage after the web app is validated.

## Existing validation baseline
At commit `69c40facb1f0994e52d118951c8ca28e9b907a21`, the repository's GitHub Actions reported dependency installation, `npm test` and `npm run build` passing. The focused pharmacy test suite currently contains five POS business-logic tests. This is not proof that all Pharmacy UI workflows or hosted Supabase migrations work end-to-end.

## Required environment
Use a dedicated development Supabase project and synthetic test records. Configure these environment variables in the AI Studio server runtime or the eventual deployment runtime as appropriate:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Only the Supabase publishable/anon key may be exposed to the browser. Do not expose service-role keys, database passwords, payment gateway secrets or signing credentials.

A safe local template is provided in `.env.example`; it contains placeholders only.

## AI Studio build instructions
Use this as the initial project instruction after import:

> Continue the existing HealthSuite 360 PharmaSuite codebase; do not replace it with a starter template. Work only on the PharmaSuite scope unless a shared platform dependency is required. Preserve React, Vite, React Router, Supabase and the current tenant/branch-aware access model. Inspect existing code and migrations before editing. Complete one workflow at a time, starting with purchase/goods receiving, stock/batch/expiry, supplier ledger/payment, prescription-aware sale/POS, customer orders, returns, quarantine, scheduled-drug register, reports and audit trail. Implement real Supabase queries/RPCs and tenant/branch/role enforcement; no fake success, mock persistence or client-side privilege checks. Add automated tests for every business rule and permission boundary. Use synthetic data only. Do not apply migrations to production. Keep the app responsive and PWA-compatible. After each workflow run tests and production build, fix failures, and report exact files, migrations and test evidence. Do not claim an Android APK exists until the Capacitor Android build has actually completed.

## Known integration gate
The hosted Supabase project previously inspected did not have the complete set of newer PharmaSuite migrations recorded. Do not connect this prototype to production or run migrations against the live project. First reconcile and test the migration chain against a dedicated development database.
