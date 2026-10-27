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

## Shared website editing

- Important metrics, kit price, contact details, and social/donation links use the admin document's `values` map; definitions and validation are in `public/rewrite/shared-content.js`. Never replace these with separate page text overrides.
- Explicit admin values override spreadsheet fields. Clearing an override with Use spreadsheet restores live spreadsheet updates. Keep this precedence in the browser and static builds.
- `source/lib/admin-identity.mjs` assigns legacy IDs and semantic keys. Preserve stable keys when changing templates so saved text, link, image, header, and footer edits survive future builds. Do not apply an edit to a different element if its key disappears.
- Canonical pages automatically enter the editor directory, get an unedited admin-source JSON snapshot, and inherit shared settings plus header/footer edits. Preserve this behavior when adding pages.

## Portfolio homepage

- `public/index.html` and `public/portfolio.css` implement the minimal centered personal portfolio. Keep its typography and styles separate from Re-Write It.
- Watertown Players and Emploid currently have empty password-screen placeholders. No passwords are configured and no private content exists behind them. Do not treat `public/locked.js` as authentication or publish confidential content through these static pages.
