import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth"; // 👈 aggiunto

const firebaseConfig = {
  apiKey: "AIzaSyBm8bwp-_f5nBDpwS1bttOLb1-ZY8vFe-E",
  authDomain: "presenze-pagina-web.firebaseapp.com",
  projectId: "presenze-pagina-web",
  storageBucket: "presenze-pagina-web.firebasestorage.app",
  messagingSenderId: "256980214470",
  appId: "1:256980214470:web:07c4e7eca56c9480846dc7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// 👇 aggiungi qui, subito dopo
setPersistence(auth, browserLocalPersistence);
