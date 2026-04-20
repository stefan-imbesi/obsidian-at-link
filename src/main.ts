import { Plugin } from "obsidian";
import { AtLinkSuggest } from "./AtLinkSuggest";

// Internal Obsidian API: app.workspace.editorSuggest.suggests is the ordered
// list of registered EditorSuggest instances. Obsidian iterates it and shows
// the first one whose onTrigger returns non-null. We push ourselves to the
// front so the @ trigger wins over other suggesters (e.g. PhraseSync) that
// also match on the same typed text.
interface EditorSuggestManager {
	suggests: unknown[];
}

interface WorkspaceWithSuggest {
	editorSuggest?: EditorSuggestManager;
}

export default class AtLinkPlugin extends Plugin {
	async onload() {
		const suggest = new AtLinkSuggest(this.app);
		this.registerEditorSuggest(suggest);

		const manager = (this.app.workspace as unknown as WorkspaceWithSuggest)
			.editorSuggest;
		if (manager && Array.isArray(manager.suggests)) {
			const idx = manager.suggests.indexOf(suggest);
			if (idx > 0) {
				manager.suggests.splice(idx, 1);
				manager.suggests.unshift(suggest);
			}
		}
	}
}
