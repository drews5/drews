# Website content updates

The team's Google Sheet is connected to the public website:
https://docs.google.com/spreadsheets/d/11sofypiViTMmyVd1tZVtnFfzYdAFbtS1rzEdX9AkIMk/edit

Edit the pale yellow Value column on the Website tab. Share the workbook with the team's chosen editors through Google Sheets. Keep keys unchanged and enter only public website content: the Website tab is published as a read-only CSV; Start here is not published.

Connected fields include the three impact figures and their labels/source notes, kit price, Donorbox campaign, chapter application, mailing address, public emails/social links, homepage introduction and mission statement, supply donation notice, FAQs, and partner quotes. Google republishes changes automatically; the Site caches the feed for about a minute. Allow a few minutes, then refresh. Empty or invalid values use approved source defaults. Public email changes do not change FormSubmit's verified delivery account.

The content is rendered on the server, including matching FAQ structured data. A short timeout and last-known-good/default values keep pages usable if Google is unavailable. The CSV parser validates numeric ranges, email addresses and HTTPS links; text is escaped. Donorbox links must stay on donorbox.org. No private Google credentials or editable sharing links are exposed to visitors.

The editable defaults are in editor-fields.json; the exact published feed is in live-sheet.json. Layout, portraits, and partner directory assets remain in the source repository. Never add submissions, donor details, or other private records to this sheet.

Photograph updates: run `python3 scripts/build-responsive-images.py` before `python3 scripts/build.py`. Responsive variants keep portraits and page photographs small; images begin loading with the page at low priority rather than waiting until the visitor reaches them. Keep original gallery files for full-size viewing.
