# Unofficial Wabbajack-Nexus Index

See which Wabbajack modlists include a Nexus mod, right on its Nexus Mods page. The extension also adds direct links to Nexus Mods on Wabbajack archive lists. Browser extensions available for both Chrome and Firefox.

## Status

The Chrome and Firefox versions are working and use the same Wabbajack data. The source is public under Apache 2.0. Automatic data publishing and browser-store releases are not enabled yet.

This is an unofficial community project. It is not affiliated with or endorsed by Wabbajack or Nexus Mods.

## What the extension does

On a supported Nexus Mods mod page, the extension adds a section showing every Wabbajack modlist that includes that mod:

- Each matching modlist appears as a card using its Wabbajack artwork. The title opens the modlist on Wabbajack.
- Each card shows how many unique Nexus mod pages are in that modlist.
- `Adult` appears only when Wabbajack classifies the modlist as NSFW.
- The extension shows when its Wabbajack data was last updated.

On a Wabbajack archive list, mod names open their Nexus Mods pages and archive filenames open the matching Nexus file pages. If the extension cannot identify an entry safely, it leaves it alone instead of guessing from the title or filename.

The data comes from Wabbajack's registered public modlists. Private and unregistered lists are not included.

## Local browser testing

Run `npm run build` after generating the public dataset. The command writes browser directories under `dist/` and matching development archives under `artifacts/`.

### Chrome

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist/chrome`. The ignored `artifacts/wabbajack-nexus-index-chrome-dev.zip` is the byte-equivalent packaged snapshot for transfer or CI retention; unpack it before loading it locally in Chrome.

### Firefox

The ignored local development package is written to `artifacts/wabbajack-nexus-index-firefox-dev.xpi`. In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…**, and select that file. Temporary add-ons are removed when Firefox exits; a normal persistent install requires Mozilla signing.

## For developers

Repository layout, development commands, data hosting, privacy boundaries, and architecture are documented in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## License

The original source code and documentation in this repository are licensed under the [Apache License 2.0](LICENSE).

That license does not grant rights to third-party names, trademarks, logos, artwork, or source metadata. Wabbajack, Nexus Mods, modlist authors, and other data sources retain their respective rights. See [docs/LICENSE_OPTIONS.md](docs/LICENSE_OPTIONS.md) for the project-specific licensing boundary.
