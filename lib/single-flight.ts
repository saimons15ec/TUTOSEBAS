export function requestKey(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
export class SingleFlight<T> {
  private pending = new Map<string, Promise<T>>();
  run(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key); if (existing) return existing;
    const promise = Promise.resolve().then(task).finally(() => this.pending.delete(key));
    this.pending.set(key, promise); return promise;
  }
}
