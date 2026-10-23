# drews.click — GitHub Pages

This repository hosts Drew's projects on GitHub Pages. The Re-Write It Project is at https://drews.click/rewrite/ and its child pages. No ChatGPT hosting or server is required.

## First publication

1. Create a **public** repository named `drews` in the `drews5` account. Leave it empty.
2. Extract the supplied ZIP. Copy everything inside it into that repository, including `.github`, `public`, `source`, `scripts`, and `package.json`. GitHub Desktop is a simple way to commit and push the folders to `main`.
3. In repository **Settings → Pages**, select **GitHub Actions** as the build source. Run **Actions → Publish drews.click → Run workflow** if it has not run already.
4. In **Settings → Pages → Custom domain**, enter `drews.click` and save. The custom domain is only the hostname; `/rewrite/` is handled by this repository's files.
5. In Spaceship's **Advanced DNS → drews.click → DNS records → Custom records**, replace conflicting parking/old hosting A records at `@` with these four A records:

   | Type | Host | Value |
   | --- | --- | --- |
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | drews5.github.io |

   Use default TTL. Do not use the prior ChatGPT hosting addresses or its verification TXT records. Preserve unrelated email records. If an old AAAA record points at another website host, remove it or replace it with GitHub's IPv6 records documented below.
6. When GitHub's DNS check succeeds and its certificate is ready, enable **Enforce HTTPS**. DNS and certificate setup may take up to 24 hours.

Official guidance: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## Editing and automatic updates

- `public/rewrite/styles.css` and `public/rewrite/app.js` are the existing site styles and interactions.
- `public/rewrite/assets/` includes the compressed images, fonts, kit graphics, and logos.
- `source/build.py` contains the original editable page templates. `source/content/` contains the team, partner, photo, and artwork data. Each build regenerates `source/pages.json`, including every existing alias.
- `source/content/editor-fields.json` stores the approved content snapshot. `live-sheet.json` identifies the team's published spreadsheet. That spreadsheet must remain publicly published for builds to read it.
- Each push rebuilds and publishes the site. The workflow also checks the spreadsheet twice an hour; scheduled GitHub jobs can be delayed. For an immediate refresh, use **Actions → Publish drews.click → Run workflow**. Scheduled workflows in inactive public repositories can be disabled by GitHub after 60 days without activity; re-enable the workflow in Actions if that happens.
- Spreadsheet changes are included in generated HTML, including FAQ structured data and donation prices. If Google is unavailable, the build uses the approved content snapshot rather than breaking the site.
- Forms submit directly to the existing verified FormSubmit recipient. Donorbox handles donations. No live form or payment submissions were made during export checks.
- Add future static projects inside `public/<project-name>/` and link them from `public/index.html`.

## Local build

Node.js 24 and Python 3.12 are recommended. Install Pillow with `python3 -m pip install Pillow==11.3.0`. GitHub Actions installs this automatically.

```sh
npm run build
npm run check
```

The publishable output is `_site/`. All internal routes, responsive image URLs, CSS fonts, metadata, and native form return URLs are mounted under `/rewrite/`. Donation amount URLs retain checkout prefilling through a browser redirect on GitHub Pages. GitHub Pages cannot return the former server-side 302 redirect.

## Verification

The export check validates each local page link, image/script/style path, responsive image URL, canonical host, form destination/return URL, and the CNAME hostname. Browser layout and live email/payment delivery were not retested as part of this hosting export.
