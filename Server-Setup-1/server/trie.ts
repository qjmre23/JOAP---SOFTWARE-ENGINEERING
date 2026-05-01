interface TrieNode {
  children: Map<string, TrieNode>;
  entries: Array<{ type: string; id: string; label: string; sublabel: string }>;
  isEnd: boolean;
}

function createNode(): TrieNode {
  return { children: new Map(), entries: [], isEnd: false };
}

export class Trie {
  private root: TrieNode = createNode();

  insert(word: string, entry: { type: string; id: string; label: string; sublabel: string }) {
    const normalized = word.toLowerCase().trim();
    if (!normalized) return;
    let node = this.root;
    for (const char of normalized) {
      if (!node.children.has(char)) {
        node.children.set(char, createNode());
      }
      node = node.children.get(char)!;
    }
    node.isEnd = true;
    const exists = node.entries.some(e => e.id === entry.id && e.type === entry.type);
    if (!exists) {
      node.entries.push(entry);
    }
  }

  remove(id: string, type: string) {
    this._removeFromNode(this.root, id, type);
  }

  private _removeFromNode(node: TrieNode, id: string, type: string) {
    node.entries = node.entries.filter(e => !(e.id === id && e.type === type));
    for (const child of node.children.values()) {
      this._removeFromNode(child, id, type);
    }
  }

  prefixSearch(prefix: string, limit = 10): Array<{ type: string; id: string; label: string; sublabel: string }> {
    const normalized = prefix.toLowerCase().trim();
    if (!normalized) return [];

    let node = this.root;
    for (const char of normalized) {
      if (!node.children.has(char)) return [];
      node = node.children.get(char)!;
    }

    const results: Array<{ type: string; id: string; label: string; sublabel: string }> = [];
    const seen = new Set<string>();
    this._collect(node, results, seen, limit);
    return results;
  }

  private _collect(
    node: TrieNode,
    results: Array<{ type: string; id: string; label: string; sublabel: string }>,
    seen: Set<string>,
    limit: number
  ) {
    if (results.length >= limit) return;
    for (const entry of node.entries) {
      const key = `${entry.type}:${entry.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(entry);
        if (results.length >= limit) return;
      }
    }
    for (const child of node.children.values()) {
      if (results.length >= limit) return;
      this._collect(child, results, seen, limit);
    }
  }

  clear() {
    this.root = createNode();
  }
}

export const globalTrie = new Trie();
