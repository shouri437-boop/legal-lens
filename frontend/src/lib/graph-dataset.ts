// DataSet-like structure for graph data management (inspired by vis-network)

export class GraphDataSet<T extends { id: string }> {
  private data: Map<string, T> = new Map();
  private listeners: Set<(items: T[]) => void> = new Set();

  add(item: T): void {
    this.data.set(item.id, item);
    this.notifyListeners();
  }

  addMultiple(items: T[]): void {
    items.forEach((item) => this.data.set(item.id, item));
    this.notifyListeners();
  }

  update(item: Partial<T> & { id: string }): void {
    const existing = this.data.get(item.id);
    if (existing) {
      this.data.set(item.id, { ...existing, ...item });
      this.notifyListeners();
    }
  }

  remove(id: string): void {
    this.data.delete(id);
    this.notifyListeners();
  }

  get(id: string): T | undefined {
    return this.data.get(id);
  }

  getAll(): T[] {
    return Array.from(this.data.values());
  }

  clear(): void {
    this.data.clear();
    this.notifyListeners();
  }

  subscribe(listener: (items: T[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const items = this.getAll();
    this.listeners.forEach((listener) => listener(items));
  }

  get size(): number {
    return this.data.size;
  }
}
