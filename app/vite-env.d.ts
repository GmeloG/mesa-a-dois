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
}
