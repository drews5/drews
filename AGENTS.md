# drews.click

This repository is the source of truth for Drew's project website. Host it on GitHub Pages; do not publish changes to ChatGPT Sites.

- The Re-Write It Project is mounted at `/rewrite/` and every internal page must stay inside that prefix.
- Preserve the nonprofit's approved Alice typography, navy/coral palette, original copy, photos, and custom kit illustrations unless Drew requests a change.
- Edit `source/build.py` for page templates, `source/content/` for source data, and `public/rewrite/styles.css` or `public/rewrite/app.js` for presentation and interactions.
- `npm run build` regenerates the static `_site/` output. `npm run check` validates links, assets, forms, and canonical URLs. The build requires Node 24, Python 3.12, and Pillow.
- `.github/workflows/pages.yml` publishes main and attempts to refresh the static spreadsheet snapshot twice an hour. GitHub's scheduler can be delayed; it is not the live update mechanism.
- Re-Write It pages read the published spreadsheet on load and every 30 seconds while visible. Edit `source/client/live-content.mjs` for this refresh and `source/lib/content-values.mjs` for shared validation. Preserve active form entries and donation amounts when content changes.
- A production build must fail if the spreadsheet remains unavailable after retries, keeping the previously deployed site instead of publishing defaults. `SKIP_LIVE_CONTENT=1` is only for explicit offline checks.
- Run `npm ci`, `npm run build`, `npm test`, and `npm run check` for content-sync changes.
- Forms submit through the existing verified FormSubmit account. Donations open Donorbox directly. Never send real test form submissions or payments.
- Before updating main, read the current branch head and preserve other projects and concurrent changes.
- Keep DNS on Spaceship pointing to GitHub Pages. Never restore the former ChatGPT custom-domain mapping.
- Future project pages belong in `public/<project>/` with links from `public/index.html`.

## Portfolio homepage

- `public/index.html` and `public/portfolio.css` implement the minimal centered personal portfolio. Keep its typography and styles separate from Re-Write It.
- Watertown Players and Emploid currently have empty password-screen placeholders. No passwords are configured and no private content exists behind them. Do not treat `public/locked.js` as authentication or publish confidential content through these static pages.
