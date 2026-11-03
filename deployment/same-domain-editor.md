# Same-domain website editor

The production editor URL is `https://www.therewriteitproject.org/admin/`.
Login, drafts, publishing and image uploads use
`https://www.therewriteitproject.org/admin/api/*`. The public pages and editor
files remain on GitHub Pages. Cloudflare handles only the API path.

## Activate hosting before publishing the frontend

1. Sign in to the Cloudflare account that owns `rewrite-admin`. Confirm the
   existing Durable Objects and password secret are present. Do not create a
   replacement Worker or reset its storage.
2. Confirm `therewriteitproject.org` is an active zone in that account, and
   `www` is proxied to the existing `drews5.github.io` origin. DNS-only records
   cannot run a Worker route. If DNS is still at Wix, copy the complete DNS
   records and check registrar access before planning a nameserver change.
   Preserve all mail and verification records. Do not change `drews.click`.
3. Before any DNS cutover, confirm Cloudflare's certificate covers `www` and
   origin TLS validation succeeds. Keep Full (strict) TLS. Do not disable
   certificate checks or DNSSEC as a shortcut. Check domain registration and
   nameserver ownership with the account owner if the current provider does
   not allow nameserver changes.
4. Deploy the existing Worker from this branch:

   ```sh
   npx wrangler@4 deploy --config admin-worker/wrangler.production.jsonc
   ```

   This adds `www.therewriteitproject.org/admin/api/*` to the same Worker and
   retains the `rewrite` Durable Object identity, bindings, migrations and
   stored edits. It keeps the legacy endpoint available to the demo.
5. Check `https://www.therewriteitproject.org/admin/api/published` returns JSON,
   and `/admin/api/draft` returns 401 without a session. Check an unrelated
   Origin remains rejected. The ordinary public site must still work over HTTPS.
6. Only after these checks pass, merge the frontend change and run the
   production GitHub Pages workflow. Its export serves the actual editor HTML,
   sets `siteOrigin` to the nonprofit hostname, sets an empty `sitePath`, and
   points `apiBase` at `/admin/api` on that hostname.
7. Open `/admin/` in a browser. Verify password sign-in, the page list, a phone
   preview, an image replacement, Save, Publish and Sign out with the team.
   Use an approved small edit and restore it after verification. Never submit a
   real test inquiry or payment. A local test cannot verify the live password
   secret, edge route or domain certificate.

## Rollback

The backend prefix support is additive. If the frontend has not been published,
there is no public UI change to undo. If it has been published, revert the
frontend commit and redeploy the previous production build before removing the
Cloudflare route. Leave the existing Worker, secret and Durable Objects intact.

Never use the editor's Revert action or erase drafts as a hosting rollback.
Keep a copy of DNS records before any nameserver change and coordinate DNS
rollback with the domain owner.
