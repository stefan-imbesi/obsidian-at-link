# At Link

A small Obsidian plugin that opens an internal-link autocomplete when you type `@` in the editor.

Companion to [PhraseSync](https://github.com/) — PhraseSync handles mid-sentence linking, while At Link provides an explicit `@` trigger for when you deliberately want to insert a wikilink.

## Behavior

- Type `@` at the start of a line or after whitespace → suggestion popup opens.
- Characters you type after `@` become the query.
- Suggestions are drawn from:
  - Vault markdown files (matched on basename)
  - Headings from `app.metadataCache`
  - Blocks that already have a `^id`
- Selecting a suggestion replaces `@query` with a proper wikilink:
  - File → `[[Note Title]]`
  - Heading → `[[Note Title#Heading]]`
  - Block → `[[Note Title#^blockid]]`
- Typing a space or pressing `Esc` closes the popup and leaves the `@` intact.
- `@` inside an email address (e.g. `foo@bar`) does not trigger — only `@` at line start or after whitespace fires.

Ranking: exact prefix → case-insensitive prefix → fuzzy subsequence. Capped at 20 results.

## Build

```bash
npm install
npm run dev     # watch build
npm run build   # one-shot production build
```

The build produces `main.js` at the project root.

## Install in your vault

Copy these three files into your vault's plugin folder:

```
main.js
manifest.json
styles.css
```

Destination: `<your-vault>/.obsidian/plugins/at-link/` — create the `at-link/` folder if it doesn't exist.

Then in Obsidian: **Settings → Community plugins → Installed plugins → enable "At Link"**.

If community plugins are off, toggle **"Restricted mode"** off first.

## Iterating

While `npm run dev` is running, the esbuild watcher rebuilds `main.js` on every source change. After each rebuild, either:

- Copy `main.js` over to the vault plugin folder, or
- Symlink the vault plugin folder to this project directory so it picks up rebuilds directly.

Reload the plugin in Obsidian (Settings → Community plugins → toggle off/on, or use the [Hot Reload](https://github.com/pjeby/hot-reload) plugin).

## Scope

Not in v1:

- Tags
- Auto-creating block IDs on selection (only existing `^id` blocks appear)
- Settings tab
- Suppressing the trigger inside code blocks
- Alias-aware matching
