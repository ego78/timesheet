// src/app/firebase.ts
"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// Puoi lasciare questi valori hardcoded oppure spostarli in variabili NEXT_PUBLIC_*
const firebaseConfig = {
  apiKey: "AIzaSyBm8bwp-_f5nBDpwS1bttOLb1-ZY8vFe-E",
  authDomain: "presenze-pagina-web.firebaseapp.com",
  projectId: "presenze-pagina-web",
  // Se non usi Firebase Storage, questo campo non incide
  storageBucket: "presenze-pagina-web.firebasestorage.app",
  messagingSenderId: "256980214470",
  appId: "1:256980214470:web:07c4e7eca56c9480846dc7",
};

// Evita re-init (utile in dev + Fast Refresh)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Esegui queste inizializzazioni SOLO in browser
if (typeof window !== "undefined") {
  // Mantiene la sessione utente tra riaperture
  setPersistence(auth, browserLocalPersistence).catch(() => { /* ignora errori (es. Safari Private) */ });

  // Abilita cache offline di Firestore (fallisce in Safari Private/multi-tab)
  enableIndexedDbPersistence(db).catch(() => { /* ignora, Firestore funziona comunque online */ });
}

export default app;
