# drews.click

This repository is the source of truth for Drew's project website. Host it on GitHub Pages; do not publish changes to ChatGPT Sites.

- The Re-Write It Project is mounted at `/rewrite/` and every internal page must stay inside that prefix.
- Preserve the nonprofit's approved Alice typography, navy/coral palette, original copy, photos, and custom kit illustrations unless Drew requests a change.
- Edit `source/build.py` for page templates, `source/content/` for source data, and `public/rewrite/styles.css` or `public/rewrite/app.js` for presentation and interactions.
- `npm run build` regenerates the static `_site/` output. `npm run check` validates links, assets, forms, and canonical URLs. The build requires Node 24, Python 3.12, and Pillow.
- `.github/workflows/pages.yml` publishes changes to main automatically. It also refreshes the team's published content spreadsheet twice an hour.
- Forms submit through the existing verified FormSubmit account. Donations open Donorbox directly. Never send real test form submissions or payments.
- Before updating main, read the current branch head and preserve other projects and concurrent changes.
- Keep DNS on Spaceship pointing to GitHub Pages. Never restore the former ChatGPT custom-domain mapping.
- Future project pages belong in `public/<project>/` with links from `public/index.html`.
