// src/app/firebase.ts
"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// ⚠️ Se vuoi, puoi spostare questi valori in variabili d'ambiente NEXT_PUBLIC_*
// ma le chiavi pubbliche Firebase possono anche stare hardcoded.
const firebaseConfig = {
  apiKey: "AIzaSyBm8bwp-_f5nBDpwS1bttOLb1-ZY8vFe-E",
  authDomain: "presenze-pagina-web.firebaseapp.com",
  projectId: "presenze-pagina-web",
  // Nota: lo storageBucket classico è "<projectId>.appspot.com".
  // Il valore attuale non influisce se non usi Storage, quindi puoi lasciarlo così.
  storageBucket: "presenze-pagina-web.firebasestorage.app",
  messagingSenderId: "256980214470",
  appId: "1:256980214470:web:07c4e7eca56c9480846dc7",
};

// Evita re-init (utile in dev + Fast Refresh)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Esegui persistenza SOLO in browser (non in SSR)
if (typeof window !== "undefined") {
  // Auth persistence su localStorage (utente resta loggato tra riaperture)
  setPersistence(auth, browserLocalPersistence).catch(() => { /* ignora */ });

  // Cache offline Firestore (ignora errori di Safari Private/ più tab aperte)
  enableIndexedDbPersistence(db).catch(() => { /* ignora */ });
}

export default app;
