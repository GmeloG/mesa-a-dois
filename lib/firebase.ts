import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, connectFirestoreEmulator } from 'firebase/firestore';
const config: FirebaseOptions = window.MESA_FIREBASE_CONFIG || {};
export const firebaseConfigured = ['apiKey', 'authDomain', 'projectId', 'appId'].every(key => {
  const value = config[key as keyof FirebaseOptions];
  return typeof value === 'string' && value.trim() !== '' && !value.includes('SUBSTITUIR');
});
const app = firebaseConfigured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? initializeFirestore(app, { localCache: memoryLocalCache() }) : null;
export const projectId = config.projectId || 'unconfigured';
if (auth) auth.languageCode = 'pt';
// Emulators are opt-in and unavailable in production builds.
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true' && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
