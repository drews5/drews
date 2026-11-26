# Cinema

Cinema is a browser build of [NuvioWeb](https://github.com/gablilli/NuvioWeb) (GPL-3.0), pinned to the revision in `scripts/build-cinema.mjs`. It keeps Nuvio's add-ons, sync, profiles, stream selection and player; this directory only holds the downstream changes.

| URL | Source |
| --- | --- |
| https://cinema.drews.click | Cloudflare Pages project `cinema` (`.github/workflows/cinema.yml`) |
| https://drews.click/cinema/ | GitHub Pages site build (unchanged) |

## Layout

- `patches.mjs` — every edit to upstream source. Each edit must match exactly once, so an upstream change fails the build instead of silently skipping a patch. Current patches: browser runtime classes (`cinema-web`, `cinema-touch`, `cinema-pointer`, `cinema-tv`), `viewport-fit=cover`, email/password sign-in for browsers (the official server advertises `email_password_auth`), a visible QR/email switch, pointer/touch activation in the focus engine (upstream wires it only on webOS), TV-only update checks, and I18n for the add-on remote page.
- `styles/*.css` — bundled in filename order into `assets/cinema.css`. `00-tokens.css` holds the design tokens; everything is scoped to `.cinema-web`, so TVs keep the upstream layout and remote navigation.

## Build and cache

`node scripts/build-cinema.mjs` fetches the pinned revision, applies the patches, compiles Nuvio, bundles the styles, and writes `CINEMA_OUTPUT` (default `cinema-dist/`) with `source.zip` (corresponding source), `version.json`, and hashed asset URLs.

The compiled core is cached under `CINEMA_CORE_CACHE`, keyed by upstream revision, Node version, `build-cinema.mjs` and `patches.mjs`. Style-only changes reuse it and only rebundle CSS (about 10 s locally). Open pages poll `version.json` (every 10 s in production) and swap the stylesheet in place; a new app hash reloads the page only after 15 s without input and while no video is playing or form field is in use.

## Local preview

```sh
PORT=8788 node scripts/cinema-dev.mjs
```

Builds once, serves with `no-store`, and rebundles `styles/` on save; open pages pick up CSS within one second.

## Tests

```sh
node scripts/cinema-smoke.mjs cinema-dist                 # static checks on a build
npm i --no-save playwright-core@1.49.1
node scripts/cinema-browser-test.mjs http://localhost:8788/   # guest flow at 375–1920 px
```

The browser test signs in as a guest and checks horizontal overflow, the phone bottom bar, Search and Settings at 375, 390, 430, 768, 1440 and 1920 px, saving screenshots to `cinema-shots/`. Set `CINEMA_CDP` to reuse a running Chrome or `CHROME_PATH` to pick the binary.

## Deployment

Pushes to `main` that touch Cinema files deploy production; pull requests deploy a Pages preview and run the browser test against it. Newer commits cancel older runs for the same branch. The workflow needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (32-character hex ID) Actions secrets. `drews.click` DNS stays on Spaceship/GitHub Pages; only the `cinema` subdomain points at Cloudflare.

## Known limitations

- `api.introdb.app` (skip-intro segments) does not send CORS headers for these origins, so intro skipping is unavailable in browsers.
- Some Metahub logo URLs return 404; Nuvio falls back to text titles.
- Browsers can only play formats they decode natively (typically H.264/AAC MP4 and HLS in Safari); MKV/HEVC streams from add-ons may not play.
