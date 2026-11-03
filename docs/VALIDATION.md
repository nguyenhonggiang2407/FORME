# First-release validation

Local verification on 3 November 2026:

- `npm run check`: 12 items, six curated looks, 18 exact SHA-256 photo matches, 520 valid combinations across all four occasions and three temperatures. Curated looks match their items' occasion/temperature tags.
- `npm test`: 11 tests passed, no failures or skips.
- Chrome browser: created a work/cool-weather outfit, cycled to a distinct combination, saved it, assigned it to a date and reloaded. The saved outfit and dated plan remained.
- Filled only empty days in a week. Packing correctly deduplicated 7 planned outfits to 10 pieces and retained a checked item after reloading.
- Wardrobe: shoe filter returned two items; an unmatched search showed a recoverable empty state. Marking a trench unavailable flagged four existing plans; restoring it removed the condition.
- Responsive checks at 390×844 and 360×800: no document horizontal overflow; builder and packing dialogs fit. Photos visible in the home viewport loaded successfully.
- Independent source review findings were resolved: distinct occasion tags, persistent storage-failure notice, backup shape validation, skip-link routing, keyboard focus treatment and consistent cool-weather layering.

Hosting and public URL verification are recorded separately after deployment. No local test state is part of the shipped source.
