import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

const raw: unknown = typeof window !== 'undefined' ? window.MESA_FIREBASE_CONFIG : undefined;
const config: FirebaseOptions = raw && typeof raw === 'object' ? raw as FirebaseOptions : {};
const REQUIRED = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
const filled = (key: typeof REQUIRED[number]) => {
  const value = config[key];
  return typeof value === 'string' && value.trim() !== '' && !value.includes('SUBSTITUIR');
};

/** Mensagem compreensível quando a configuração está ausente ou inválida; vazio quando está correta. */
export let firebaseProblem = '';
if (typeof window !== 'undefined' && window.MESA_CONFIG_ERROR) firebaseProblem = window.MESA_CONFIG_ERROR;
else if (!raw) firebaseProblem = 'O ficheiro firebase-config.js não definiu window.MESA_FIREBASE_CONFIG.';
else if (!REQUIRED.every(filled)) firebaseProblem = `Faltam valores na configuração: ${REQUIRED.filter(k => !filled(k)).join(', ')}.`;
else if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(String(config.apiKey))) firebaseProblem = 'O valor apiKey da configuração não parece válido.';

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
if (!firebaseProblem) {
  try {
    app = initializeApp(config);
    authInstance = getAuth(app);
    dbInstance = initializeFirestore(app, { localCache: memoryLocalCache() });
    authInstance.languageCode = 'pt';
  } catch (error) {
    firebaseProblem = `Não foi possível iniciar o Firebase: ${error instanceof Error ? error.message : String(error)}`;
    app = null; authInstance = null; dbInstance = null;
  }
}
export const firebaseConfigured = !firebaseProblem;
export const auth = authInstance;
export const db = dbInstance;
export const projectId = config.projectId || 'unconfigured';

// Emulators are opt-in and unavailable in production builds.
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true' && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
