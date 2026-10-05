import { doc, getDocFromServer, onSnapshot, runTransaction, serverTimestamp, type DocumentData, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { initialState, type State } from './model';
import { ConflictError, parseState, payload, readCache, writeCache, type PlanStore, type Snapshot } from './store';
export function firebaseMessage(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  if (code.includes('permission-denied')) return 'Esta conta ainda não tem acesso ao plano. Confirma o documento de acesso e as regras do Firestore.';
  if (code.includes('unavailable') || code.includes('network-request-failed')) return 'Não foi possível ligar ao Firebase. Verifica a ligação e tenta novamente.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'O email ou a palavra-passe não estão corretos.';
  if (code.includes('too-many-requests')) return 'Foram feitas demasiadas tentativas. Aguarda antes de tentar novamente.';
  if (code.includes('invalid-api-key') || code.includes('configuration-not-found')) return 'A configuração do Firebase ainda não está correta.';
  if (code.includes('operation-not-allowed')) return 'Ativa o método Email/Palavra-passe em Firebase Authentication.';
  if (code.includes('invalid-email')) return 'Introduz um endereço de email válido.';
  if (code.includes('user-disabled')) return 'Esta conta foi desativada.';
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}
export function firebaseStore(database: Firestore, user: User, project: string): PlanStore {
  const cacheKey = `mesa-a-dois-offline-v2:${project}:${user.uid}`;
  let household: string | null = null;
  let stopped = false;
  function decode(data: DocumentData): Snapshot {
    if (typeof data.payload !== 'string' || !Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error('O plano guardado tem um formato inválido.');
    return { state: parseState(JSON.parse(data.payload)), revision: data.revision, updatedAt: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString() };
  }
  async function stateRef() {
    // Always ask the server: a removed access grant must not persist in cache.
    const access = await getDocFromServer(doc(database, 'access', user.uid));
    const value = access.data()?.householdId;
    if (!access.exists() || typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) {
      localStorage.removeItem(cacheKey); throw new Error('Esta conta ainda não está associada ao vosso plano. Cria o documento access/' + user.uid + ' no Firebase.');
    }
    household = value;
    return doc(database, 'households', value, 'state', 'main');
  }
  const store: PlanStore = {
    mode: 'firebase', identity: user.email || 'Conta Firebase',
    async load() {
      const target = await stateRef();
      const result = await runTransaction(database, async transaction => {
        const saved = await transaction.get(target);
        if (saved.exists()) return decode(saved.data());
        const snapshot = { state: initialState(), revision: 1, updatedAt: new Date().toISOString() };
        transaction.set(target, { payload: payload(snapshot.state), revision: 1, updatedAt: serverTimestamp() });
        return snapshot;
      });
      writeCache(cacheKey, result); return result;
    },
    async save(state: State, expectedRevision: number) {
      if (!household) throw new Error('Abre o plano com ligação antes de guardar.');
      const target = doc(database, 'households', household, 'state', 'main');
      const encoded = payload(state);
      const result = await runTransaction(database, async transaction => {
        const saved = await transaction.get(target);
        if (!saved.exists() || saved.data().revision !== expectedRevision) throw new ConflictError();
        const revision = expectedRevision + 1;
        transaction.set(target, { payload: encoded, revision, updatedAt: serverTimestamp() });
        return { state, revision, updatedAt: new Date().toISOString() };
      });
      writeCache(cacheKey, result); return result;
    },
    subscribe(callback, onError) {
      stopped = false; let unsubscribe: (() => void) | undefined;
      stateRef().then(target => {
        if (stopped) return;
        unsubscribe = onSnapshot(target, { includeMetadataChanges: true }, snap => {
          if (!snap.exists() || snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
          try { const result = decode(snap.data()); writeCache(cacheKey, result); callback(result); } catch (error) { onError(error); }
        }, error => { if (error.code === 'permission-denied') localStorage.removeItem(cacheKey); onError(error); });
      }).catch(onError);
      return () => { stopped = true; unsubscribe?.(); };
    },
    cached: () => readCache(cacheKey),
    clearCache: () => { localStorage.removeItem(cacheKey); },
  };
  return store;
}
