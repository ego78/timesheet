"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // intercetta evento PWA installabile
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const alreadySeen = localStorage.getItem("pwaModalShown");
      if (!alreadySeen) {
        setShowModal(true); // prima visita → fullscreen
        localStorage.setItem("pwaModalShown", "true");
      } else {
        setShowToast(true); // successive → toast compatto
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowModal(false);
      setShowToast(false);
      localStorage.setItem("pwaInstalled", "true");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Se è già installata, non mostrare nulla
    if (window.matchMedia("(display-mode: standalone)").matches || localStorage.getItem("pwaInstalled") === "true") {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Funzione per avviare l’installazione
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setShowModal(false);
      setShowToast(false);
      localStorage.setItem("pwaInstalled", "true");
    }
  };

  if (isInstalled) return null;

  return (
    <>
      {/* ========================= MODAL FULLSCREEN ========================= */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center text-center p-6"
          >
            {/* Immagine flat */}
            <div className="w-full max-w-md rounded-xl overflow-hidden border bg-slate-50 shadow-lg">
              <picture>
                <source srcSet="/images/pwa-flat.webp" type="image/webp" />
                <img
                  src="/images/pwa-flat.png"
                  alt="Installa l'app sul tuo dispositivo"
                  loading="eager"
                  className="w-full h-auto object-cover"
                />
              </picture>
            </div>

            <h2 className="mt-6 text-2xl font-semibold text-slate-800">
              Installa l'app sul tuo dispositivo
            </h2>
            <p className="mt-2 text-slate-600 max-w-sm">
              Aggiungi l'app alla schermata principale per un accesso più veloce e un'esperienza completa.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleInstall}
                className="bg-sky-600 hover:bg-sky-700 text-white font-medium px-5 py-2 rounded-xl shadow"
              >
                Installa ora
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium px-5 py-2 rounded-xl"
              >
                Più tardi
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Su iPhone: apri in Safari e scegli <strong>“Aggiungi alla schermata Home”</strong>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================= TOAST COMPATTO ========================= */}
      <AnimatePresence>
        {showToast && !isInstalled && (
          <motion.div
            key="toast"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[99] bg-white border shadow-lg rounded-full px-4 py-2 flex items-center gap-3"
          >
            <picture>
              <source srcSet="/images/pwa-flat.webp" type="image/webp" />
              <img
                src="/images/pwa-flat.png"
                alt="App icon"
                className="w-8 h-8 rounded-full object-cover border"
              />
            </picture>
            <span className="text-sm text-slate-800 font-medium">
              Installa l'app per un accesso rapido
            </span>
            <button
              onClick={handleInstall}
              className="ml-2 text-sky-600 font-semibold text-sm hover:underline"
            >
              Installa
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
