# First-release validation

Local verification on 3 November 2026:

- `npm run check`: 12 items, six curated looks, 18 exact SHA-256 photo matches, 520 valid combinations across all four occasions and three temperatures. Curated looks match their items' occasion/temperature tags.
- `npm test`: 11 tests passed, no failures or skips.
- Chrome browser: created a work/cool-weather outfit, cycled to a distinct combination, saved it, assigned it to a date and reloaded. The saved outfit and dated plan remained.
- Filled only empty days in a week. Packing correctly deduplicated 7 planned outfits to 10 pieces and retained a checked item after reloading.
- Wardrobe: shoe filter returned two items; an unmatched search showed a recoverable empty state. Marking a trench unavailable flagged four existing plans; restoring it removed the condition.
- Responsive checks at 390×844 and 360×800: no document horizontal overflow; builder and packing dialogs fit. Photos visible in the home viewport loaded successfully.
- Independent source review findings were resolved: distinct occasion tags, persistent storage-failure notice, backup shape validation, skip-link routing, keyboard focus treatment and consistent cool-weather layering.

## Deployment and actual HTTPS checks

- Public demo: https://nguyenhonggiang2407.github.io/FORME/
- Source application commit: `60daac654e66c4b919f0343c199d5af51ee922ea`.
- [GitHub workflow 41665851948](https://github.com/nguyenhonggiang2407/FORME/actions/runs/41665851948): verification and deployment succeeded after initial Pages setup was enabled. HTTPS is enforced by GitHub Pages.
- `tools/verify-live.mjs` fetched all 26 public application files, confirmed HTTP 200, appropriate image/script MIME types and exact SHA-256 agreement with the local tested application. No authentication was used for these requests.
- Chrome at the public HTTPS URL: original photo loaded; Denim Days was assigned to a date and survived a reload. A new evening/cool-weather outfit used real catalogue pieces and a layer, and was saved successfully. A seven-day plan yielded ten deduplicated packing items; checking a packed piece updated its count.
- The Live Demo link was added only after these public checks passed. No local browser test state is part of the shipped source.

A separate owner-private Sites preview was published successfully from the same source. The public portfolio link above uses GitHub Pages and does not require a ChatGPT account.
