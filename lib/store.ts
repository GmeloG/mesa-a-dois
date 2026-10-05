import { initialState, exampleWeek, monday, localDate, validateState, type State } from './model.ts';
import { stateSchema } from './validation.ts';
export type Snapshot = { state: State; revision: number; updatedAt: string; cached?: boolean };
export interface PlanStore {
  mode: 'firebase' | 'demo';
  identity: string;
  load(): Promise<Snapshot>;
  save(state: State, revision: number): Promise<Snapshot>;
  subscribe(callback: (snapshot: Snapshot) => void, error: (error: unknown) => void): () => void;
  cached(): Snapshot | null;
  clearCache(): void;
}
export class ConflictError extends Error {
  constructor() { super('O plano foi alterado no outro dispositivo. Atualiza e revê a alteração antes de guardar novamente.'); }
}
export function parseState(value: unknown): State { return validateState(stateSchema.parse(value)); }
export function payload(state: State): string {
  const result = JSON.stringify(parseState(state));
  if (new TextEncoder().encode(result).byteLength > 800000) throw new Error('O histórico atingiu o limite desta versão. Remove refeições antigas antes de continuar.');
  return result;
}
export function writeCache(key: string, snapshot: Snapshot) { try { localStorage.setItem(key, JSON.stringify(snapshot)); } catch { /* Only an optional offline copy. */ } }
export function readCache(key: string): Snapshot | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (!raw || !Number.isSafeInteger(raw.revision) || typeof raw.updatedAt !== 'string') return null;
    return { state: parseState(raw.state), revision: raw.revision, updatedAt: raw.updatedAt, cached: true };
  } catch { return null; }
}
export function demoStore(): PlanStore {
  const key = 'mesa-a-dois-demo-v2';
  let current = readCache(key) || { state: exampleWeek(initialState(), monday(localDate())), revision: 1, updatedAt: new Date().toISOString() };
  const subscribers = new Set<(s: Snapshot) => void>();
  const get = () => readCache(key) || current;
  return {
    mode: 'demo', identity: 'Demonstração neste dispositivo',
    async load() { current = get(); return { ...current, cached: false }; },
    async save(state, revision) {
      if (get().revision !== revision) throw new ConflictError();
      current = { state: parseState(state), revision: revision + 1, updatedAt: new Date().toISOString() };
      writeCache(key, current); subscribers.forEach(fn => fn(current)); return current;
    },
    subscribe(callback) {
      subscribers.add(callback);
      const listener = (event: StorageEvent) => { if (event.key === key) callback({...get(),cached:false}); };
      window.addEventListener('storage', listener);
      return () => { subscribers.delete(callback); window.removeEventListener('storage', listener); };
    },
    cached: () => readCache(key),
    clearCache: () => { localStorage.removeItem(key); current = { state: initialState(), revision: 1, updatedAt: new Date().toISOString() }; },
  };
}
