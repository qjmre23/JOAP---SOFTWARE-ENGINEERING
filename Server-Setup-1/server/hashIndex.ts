interface IndexEntry {
  type: string;
  id: string;
  label: string;
  sublabel: string;
  data?: any;
}

export class HashIndex {
  private index: Map<string, IndexEntry> = new Map();

  set(key: string, entry: IndexEntry) {
    this.index.set(key.toLowerCase(), entry);
  }

  get(key: string): IndexEntry | undefined {
    return this.index.get(key.toLowerCase());
  }

  remove(key: string) {
    this.index.delete(key.toLowerCase());
  }

  has(key: string): boolean {
    return this.index.has(key.toLowerCase());
  }

  clear() {
    this.index.clear();
  }

  size(): number {
    return this.index.size;
  }

  lookup(key: string): IndexEntry | undefined {
    return this.get(key);
  }
}

export const itemIndex = new HashIndex();
export const orderIndex = new HashIndex();
export const customerIndex = new HashIndex();
export const trackingIndex = new HashIndex();
export const barcodeIndex = new HashIndex();
