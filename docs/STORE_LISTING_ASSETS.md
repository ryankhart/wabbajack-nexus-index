# Browser store listing assets

This document records approved source media and the preparation required before publishing the Chrome Web Store and Firefox Add-ons listings. Saving an asset here does not approve either store submission.

## Archive search link demo

Use [`store-assets/wabbajack-archive-search-links.gif`](store-assets/wabbajack-archive-search-links.gif) as the source recording for media on both browser-store pages when they are published.

The recording shows the LoreRim Archive Search page on Wabbajack. The extension turns the `Diplomatic Dragons-70803-1-0-1-1657195909.7z` archive result into a link, highlights it on hover, and opens the matching "Diplomatic Dragons - Delayed Random Dragons" page on Nexus Mods.

Suggested caption:

> Open Wabbajack archive results directly on Nexus Mods.

### Source master

- Format: animated GIF
- Dimensions: 1260 x 776 pixels
- Frames: 143
- Frame duration: 40 ms
- Loop setting: continuous (`0`)
- File size: 13,556,215 bytes
- SHA-256: `037a91e5419f5d5bceec2d100adfcf239ac1c7d5805a2db90fac2834a5ede2b1`

Keep this file unchanged as the source master. Create store-specific derivatives from it rather than overwriting it.

## Chrome Web Store preparation

Chrome requires screenshots at 1280 x 800 or 640 x 400 pixels with square corners, no padding, and full-bleed content.[1] The listing supports a YouTube promotional-video URL, while its promotional tiles must be static PNG or JPEG files at their specified dimensions.[2]

Before submission:

1. Export a clear frame from this recording as a 1280 x 800 PNG. Crop the source to a 1.6:1 frame before resizing so the image remains full bleed.
2. Use the animated recording as the source for a short promotional video if motion is still useful. Upload that video separately and enter its YouTube URL in the listing.
3. Keep the static screenshot and video focused on the same Archive Search interaction shown in this source.

Do not upload the current GIF as a Chrome screenshot or promotional tile.

## Firefox Add-ons preparation

Mozilla recommends 1280 x 800 screenshots, which is the maximum displayed size, or the same 1.6:1 ratio for other dimensions.[3]

Before submission:

1. Use the same 1280 x 800 still prepared from this recording for the Chrome listing.
2. Keep the GIF as source footage rather than assuming that AMO accepts or animates it. The cited Mozilla listing guidance does not document animated extension screenshots.[3]
3. If Mozilla explicitly documents animated screenshot support before publication, verify the result in the public preview before replacing the still.
4. Preserve the suggested caption and keep this interaction consistent with the Chrome listing.

## Sources

[1] https://developer.chrome.com/docs/webstore/images — Supplying Images | Chrome for Developers
[2] https://developer.chrome.com/docs/webstore/cws-dashboard-listing — Complete your listing information | Chrome for Developers
[3] https://extensionworkshop.com/documentation/develop/create-an-appealing-listing — Create an appealing listing | Firefox Extension Workshop
