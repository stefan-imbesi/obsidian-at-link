import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
	prepareFuzzySearch,
} from "obsidian";

type Candidate =
	| { kind: "file"; file: TFile; key: string }
	| { kind: "heading"; file: TFile; heading: string; level: number; key: string }
	| { kind: "block"; file: TFile; blockId: string; key: string };

const MAX_RESULTS = 20;

// Score tiers keep prefix matches above fuzzy subsequence matches regardless of
// how strong the fuzzy match is.
const SCORE_EXACT_PREFIX = 3000;
const SCORE_CI_PREFIX = 2000;
const SCORE_FUZZY_BASE = 1000; // fuzzy score (0..1) is added on top

export class AtLinkSuggest extends EditorSuggest<Candidate> {
	constructor(app: App) {
		super(app);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const before = line.slice(0, cursor.ch);

		// Find the last '@' on the line up to the cursor.
		const atPos = before.lastIndexOf("@");
		if (atPos === -1) return null;

		// Only trigger when '@' is at start-of-line or follows whitespace —
		// avoids firing inside email addresses or handles like foo@bar.
		if (atPos > 0) {
			const prevChar = before[atPos - 1];
			if (!/\s/.test(prevChar)) return null;
		}

		// Any whitespace between '@' and the cursor cancels the trigger
		// (typing a space after @ closes the popup, per spec).
		const query = before.slice(atPos + 1);
		if (/\s/.test(query)) return null;

		return {
			start: { line: cursor.line, ch: atPos },
			end: cursor,
			query,
		};
	}

	getSuggestions(context: EditorSuggestContext): Candidate[] {
		const query = context.query;
		const files = this.app.vault.getMarkdownFiles();

		// Empty query: show recent files first for quick access.
		if (query.length === 0) {
			const recent = this.app.workspace.getLastOpenFiles();
			const recentSet = new Set(recent);
			const inRecent: Candidate[] = [];
			const others: Candidate[] = [];
			for (const f of files) {
				const c: Candidate = { kind: "file", file: f, key: f.basename };
				if (recentSet.has(f.path)) inRecent.push(c);
				else others.push(c);
			}
			inRecent.sort(
				(a, b) =>
					recent.indexOf(a.file.path) - recent.indexOf(b.file.path)
			);
			return [...inRecent, ...others].slice(0, MAX_RESULTS);
		}

		const fuzzy = prepareFuzzySearch(query);
		const lowerQuery = query.toLowerCase();

		const scored: Array<{ candidate: Candidate; score: number }> = [];

		const consider = (candidate: Candidate) => {
			const key = candidate.key;
			// Tier 1: exact prefix (case-sensitive)
			if (key.startsWith(query)) {
				scored.push({ candidate, score: SCORE_EXACT_PREFIX });
				return;
			}
			// Tier 2: case-insensitive prefix
			if (key.toLowerCase().startsWith(lowerQuery)) {
				scored.push({ candidate, score: SCORE_CI_PREFIX });
				return;
			}
			// Tier 3: fuzzy subsequence
			const result = fuzzy(key);
			if (result) {
				// result.score is negative (higher = better, capped at 0).
				// Normalize into 0..1 range roughly — longer keys produce more
				// negative scores, so bias by key length.
				const normalized = 1 / (1 + Math.max(0, -result.score));
				scored.push({ candidate, score: SCORE_FUZZY_BASE + normalized });
			}
		};

		for (const file of files) {
			consider({ kind: "file", file, key: file.basename });

			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache) continue;

			if (cache.headings) {
				for (const h of cache.headings) {
					consider({
						kind: "heading",
						file,
						heading: h.heading,
						level: h.level,
						key: h.heading,
					});
				}
			}

			if (cache.blocks) {
				for (const id of Object.keys(cache.blocks)) {
					consider({
						kind: "block",
						file,
						blockId: id,
						key: id,
					});
				}
			}
		}

		scored.sort((a, b) => b.score - a.score);
		return scored.slice(0, MAX_RESULTS).map((s) => s.candidate);
	}

	renderSuggestion(candidate: Candidate, el: HTMLElement): void {
		el.addClass("at-link-suggest-item");
		const primary = el.createDiv({ cls: "at-link-suggest-primary" });
		const secondary = el.createDiv({ cls: "at-link-suggest-secondary" });

		switch (candidate.kind) {
			case "file": {
				primary.setText(candidate.file.basename);
				const parent = candidate.file.parent?.path;
				secondary.setText(parent && parent !== "/" ? parent : "File");
				break;
			}
			case "heading": {
				primary.setText(`# ${candidate.heading}`);
				secondary.setText(
					`${candidate.file.basename} · H${candidate.level}`
				);
				break;
			}
			case "block": {
				primary.setText(`^${candidate.blockId}`);
				secondary.setText(`${candidate.file.basename} · block`);
				break;
			}
		}
	}

	selectSuggestion(
		candidate: Candidate,
		_evt: MouseEvent | KeyboardEvent
	): void {
		if (!this.context) return;

		const sourcePath = this.context.file?.path ?? "";
		const linktext = this.app.metadataCache.fileToLinktext(
			candidate.file,
			sourcePath,
			true // omit .md extension
		);

		let insert: string;
		switch (candidate.kind) {
			case "file":
				insert = `[[${linktext}]]`;
				break;
			case "heading":
				insert = `[[${linktext}#${candidate.heading}]]`;
				break;
			case "block":
				insert = `[[${linktext}#^${candidate.blockId}]]`;
				break;
		}

		this.context.editor.replaceRange(
			insert,
			this.context.start,
			this.context.end
		);
	}
}
