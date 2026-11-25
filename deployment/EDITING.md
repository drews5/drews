# Editing the Re-Write It site

Open the editor from the footer skyline or the site's `/admin/` entry.

- Open a page and use **Content** or **Preview** to edit its existing copy,
  links, and photos. **Manage content** opens the lists available on that page.
  That includes homepage testimonials and FAQs, Chapter FAQs, the founding
  timeline, the Impact directory and gallery, and **Page updates**. **Section
  order** moves the supported sections without moving forms or checkout.
- In **Manage team**, open a person and choose the sections where they should
  show. Clear a section to take the card off just that list. **Remove** takes
  that profile off the entire site.
- **Save draft** keeps changes private. **Review changes** checks the current
  draft against the live site. Confirm **Publish to website** only once that
  list looks right.
- In **Review changes → Recovery options**, reset a page or the full draft to
  the live content, or load the latest saved draft. Use **Undo** to recover
  the copy you were editing. After publishing, the editor keeps one prior
  live version in this session. Restoring it creates a draft for review; it
  does not publish automatically.

## Content infrastructure

Collections store stable item keys and field-level overrides in the existing
draft document under `collections[route]`. New lists use the central
definitions in `public/rewrite/content-collections.js`. Define allowed fields
and a renderer there, and wire the target when identifying a list. Do not expose
arbitrary author HTML or regenerate original keys from an editor's sort order.

The build assigns legacy identities before adding the management markers or
moving sections. The preview and static build call the same projector.
When the published version differs from a visitor's static page, the public
runtime projects the latest changes from the unedited page source, then mounts
only the managed regions and restores cleared text/image overrides. It does
not replace forms, checkout, the navigation, or the editor iframe.

The Worker still checks draft revisions on save and publish. The editor can
merge non-overlapping concurrent changes, and requires a new review if the
work to be published changes. There is no Worker deployment, new credential,
or content migration for these tools.

Useful checks: `npm test`, `npm run build:production`, and `npm run check`.
In a local fixture, add an item, hide a template item, save, review, then
publish. Refresh an older public snapshot and check the list and any open form.
Do not use the live editor to publish test content.
