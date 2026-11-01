# The Re-Write It Project production launch

The shared source remains in `drews5/drews`. Its existing GitHub Pages deployment
continues to serve the personal portfolio and `/rewrite/` demo. Do not change
that repository's Pages domain or its `public/CNAME`.

## Production build

Run `npm ci` and `npm run build:production`. This fetches the current spreadsheet
and published editor content, builds the demo, and exports only the nonprofit to
`_production/` at `https://therewriteitproject.org/`.

Every normal main-branch build also validates this export and uploads it as the
`rewrite-production` Actions artifact. No portfolio files are included. Internal
page paths, asset paths, canonical URLs, sitemap, structured data, and FormSubmit
return URLs use the production root. Legacy Wix page aliases remain available.
Saved editor identities do not change. Published future links and images are
rebased in the production browser while remaining unchanged on the demo.

The production `/admin/` entry opens the existing authenticated Worker editor.
Its public feed accepts GET requests from the production and www origins; those
origins do not gain cross-origin access to login, drafts, or publishing.

## GitHub Pages deployment

GitHub Pages supports one site per repository. Create a separate production
repository, for example `drews5/rewrite-it-project`, and install
`production-pages.yml` from this directory as `.github/workflows/pages.yml` in
that repository. Select GitHub Actions under Settings > Pages and run the workflow.
It builds from the current shared source and checks for code updates every half
hour; a manual run publishes sooner. Live sheet and published editor values still
refresh in the browser independently of that schedule.

Before changing DNS, configure `therewriteitproject.org` as the production
repository's Pages custom domain. Verify the deployed artifact is the nonprofit
root export, not the personal portfolio. Preserve the Wix DNS screenshot/records
as a rollback reference.

## Wix DNS switch (not performed by the build)

Keep `ns8.wixdns.net` and `ns9.wixdns.net`, plus every existing MX/TXT/email record.
Replace only the three existing Wix apex A records with all four GitHub Pages A
records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
`185.199.111.153`. Replace `www` CNAME `cdn3.wixdns.net` with `drews5.github.io`.
In Wix, leave the apex host field blank when adding an A record. TTL 1 hour is fine.

After DNS checks succeed and the certificate is issued, enable Enforce HTTPS in
the production repository's Pages settings. Check apex and www, all navigation,
images, mobile layout, `/admin/`, form return URLs, the published metrics feed, and
Donorbox links. Do not send real test form submissions or payments.

Rollback: restore the three original A records (`185.230.63.171`,
`185.230.63.186`, `185.230.63.107`) and `www` CNAME `cdn3.wixdns.net`.
Leave the original Wix site available until launch is verified.
