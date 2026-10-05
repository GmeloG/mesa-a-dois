/// <reference types="vite/client" />
interface Window {
  MESA_FIREBASE_CONFIG?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
    messagingSenderId?: string;
    storageBucket?: string;
  };
  /** Erro detetado ao carregar public/firebase-config.js (definido em index.html). */
  MESA_CONFIG_ERROR?: string;
  /** Marcado quando o React terminou o primeiro arranque. */
  __mesaBooted?: boolean;
}
