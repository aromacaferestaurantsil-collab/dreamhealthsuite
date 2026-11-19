# Custom domain: dreamhealthsuite.astheria.xyz

The repository is configured to publish the standalone Vite web app to GitHub Pages from the `master` branch.

## DNS record required
At the DNS provider that manages `astheria.xyz`, create:

| Type | Name / Host | Target / Value |
|---|---|---|
| CNAME | `dreamhealthsuite` | `aromacaferestaurantsil-collab.github.io` |

Use DNS-only / standard CNAME mode if the provider offers a proxy toggle. Do not create an A record for this subdomain. Allow DNS propagation, then enable HTTPS in the repository's Pages settings after GitHub verifies the record.

## GitHub Actions configuration
Set these repository Actions variables/secrets:
- Actions variable `VITE_SUPABASE_URL`: the dedicated HealthSuite 360 Supabase project URL.
- Actions secret `VITE_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key.

The deployment workflow intentionally stops if either value is missing. Never use a Supabase service-role key in a browser build.

## Supabase Auth
After the domain resolves and HTTPS is active, add `https://dreamhealthsuite.astheria.xyz` as the Supabase Auth Site URL and allow-list redirect URL. Update any OAuth provider callback/allowed origins as needed.

## Status
The DNS record and GitHub Pages deployment cannot be completed from this repository alone. The domain's DNS zone is controlled by its DNS provider. The workflow deploys only after the migration is merged to `master` and the required GitHub Actions values are configured. Do not point production users at this domain until the full migration is complete and browser tests pass.
