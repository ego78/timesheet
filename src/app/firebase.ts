// src/app/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBm8bwp-_f5nBDpwS1bttOLb1-ZY8vFe-E",
  authDomain: "presenze-pagina-web.firebaseapp.com",
  projectId: "presenze-pagina-web",
  storageBucket: "presenze-pagina-web.firebasestorage.app",
  messagingSenderId: "256980214470",
  appId: "1:256980214470:web:07c4e7eca56c9480846dc7",
};

// evita re-init in sviluppo/fast refresh
const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// persistenza locale auth
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Firestore + cache offline
export const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(() => {
  // Safari private o ambienti non compatibili: ignora l’errore
});
