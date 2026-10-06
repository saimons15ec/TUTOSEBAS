export class DraftRegistry {
  private scopes = new Map<string, { dirty: () => boolean; reset: () => void }>();
  register(id: string, dirty: () => boolean, reset: () => void = () => {}) { this.scopes.set(id, { dirty, reset }); return () => { this.scopes.delete(id); }; }
  dirty(ids?: readonly string[]) { return [...this.scopes].some(([id, scope]) => (!ids || ids.includes(id)) && scope.dirty()); }
  clear(id: string) { this.scopes.get(id)?.reset(); }
  confirm(ask: () => boolean, ids?: readonly string[]) { if (!this.dirty(ids)) return true; if (!ask()) return false; for (const [id, scope] of this.scopes) if (!ids || ids.includes(id)) scope.reset(); return true; }
}
