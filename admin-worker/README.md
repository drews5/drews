# Re-Write It website editor backend

The public site stays on GitHub Pages. This separate Cloudflare Worker stores editor sessions, drafts, published edits, and uploaded images in a SQLite Durable Object. No GitHub token is needed. All draft and publish operations are serialized to prevent simultaneous editors from overwriting each other silently.

## Deploy with the site owner's Cloudflare account

1. From this directory, run `npx wrangler@4 login` and authenticate with the owner's Cloudflare account.
2. Run `npx wrangler@4 secret put ADMIN_PASSWORD`. At the secure prompt, enter the requested admin password. Do not commit this value or place it in a public configuration file.
3. Run `npx wrangler@4 deploy`. Wrangler creates the Durable Object binding and prints the Worker HTTPS URL.
4. Set `public/rewrite/admin-config.json` to `{"apiBase":"https://THE-DEPLOYED-WORKER.workers.dev"}` and publish the GitHub Pages build.
5. Click the Chicago skyline five times, with no more than two seconds between clicks. Sign in at the resulting `/rewrite/admin/` page.

The password is verified by the Worker. Eight-hour session tokens remain in the editor tab's session storage. Six incorrect password attempts from an IP are blocked for 15 minutes. Drafts and images survive code deployments. Published edits reach open public pages on the next 30-second refresh. Static builds also apply the published edits for search engines; a configured but unavailable backend causes the build to fail rather than replace the content with defaults.

Images are compressed in the editor to WebP at a maximum 2,000-pixel edge. Uploads are limited to 3 MB. Photos added to the public site are public; drafts and draft text require authentication. Header and footer edits are shared across pages. Page text edits override matching spreadsheet copy; revert the element in the editor to return control to the spreadsheet.

Cloudflare usage limits and billing belong to the site owner. The Worker must be connected before the admin login is enabled. Never replace backend authentication with a password embedded in the static site.

## Edge reports ERR_QUIC_PROTOCOL_ERROR

First verify that the editor and API respond over HTTP/2. If they do, test the affected Edge browser with Experimental QUIC protocol disabled in `edge://flags`, then relaunch Edge. This keeps HTTPS encryption and changes the transport used to reach Cloudflare. On managed computers, an administrator may need to set the Edge `QuicAllowed` policy instead.

Cloudflare adds its own `Alt-Svc` advertisement on the `workers.dev` hostname. Setting `Alt-Svc: clear` in the Worker was tested and the edge overwrote it; do not treat that application header as a fix. A custom domain in an owner-controlled Cloudflare zone would allow HTTP/3 to be disabled at the zone level.

References: [Cloudflare protocol troubleshooting](https://developers.cloudflare.com/speed/optimization/protocol/troubleshooting/protocol-troubleshooting/) and [Microsoft Edge QUIC policy](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/QuicAllowed).
