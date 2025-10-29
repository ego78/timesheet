"use client";

import React from "react";

/**
 * Banner/Toast per invitare all'installazione della PWA
 * - Android/Chrome: usa beforeinstallprompt
 * - iOS/Safari: mostra istruzioni Add to Home
 * - Throttling: non ripropone per N giorni se chiudi
 */

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const STORAGE_KEY = "pwaPromptDismissedUntil";
const COOLDOWN_DAYS = 7; // ripropone dopo 7 giorni se chiuso

function isStandalone(): boolean {
  // iOS Safari
  const nav = (navigator as any);
  if ("standalone" in window.navigator && (window.navigator as any).standalone) return true;
  // altri browser
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isIosSafari(): boolean {
  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  // Safari (no Chrome/Firefox su iOS)
  const isSafari = isIOS && !!(window as any).webkit && !/crios|fxios|edgios/.test(ua);
  return isIOS && isSafari;
}

function isCooldownActive(): boolean {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return false;
    const until = new Date(s).getTime();
    return Date.now() < until;
  } catch {
    return false;
  }
}

function setCooldown(days = COOLDOWN_DAYS) {
  try {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    localStorage.setItem(STORAGE_KEY, until.toISOString());
  } catch {}
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<DeferredPromptEvent | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = React.useState(false);
  const [showIosBanner, setShowIosBanner] = React.useState(false);

  // intercetta beforeinstallprompt per Android/Chrome
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // già installata o in standalone → non mostrare
    if (isStandalone()) return;

    // cooldown attivo → non mostrare
    if (isCooldownActive()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as DeferredPromptEvent);
      // piccolo delay per non “saltare addosso”
      setTimeout(() => setShowAndroidBanner(true), 500);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall as any);

    // iOS Safari non ha beforeinstallprompt → mostra istruzioni
    if (isIosSafari()) {
      setTimeout(() => setShowIosBanner(true), 800);
    }

    // se l’utente installa, chiudi tutto e rimuovi cooldown
    const onAppInstalled = () => {
      setShowAndroidBanner(false);
      setShowIosBanner(false);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    };
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as any);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowAndroidBanner(false);
      } else {
        // rifiutato → non riproporre per un po’
        setCooldown();
        setShowAndroidBanner(false);
      }
      setDeferredPrompt(null);
    } catch {
      setCooldown();
      setShowAndroidBanner(false);
      setDeferredPrompt(null);
    }
  }

  function handleClose() {
    setCooldown();
    setShowAndroidBanner(false);
    setShowIosBanner(false);
  }

  return (
    <>
      {/* Banner Android/Chrome */}
      {showAndroidBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-[100]">
          <div className="rounded-2xl border shadow-lg bg-white p-3 flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt=""
              className="h-9 w-9 rounded-md"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">Installa “Ore App”</p>
              <p className="text-xs text-slate-600 truncate">
                Aggiungi l’app alla schermata Home per un accesso più veloce.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleClose}
                className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
              >
                No, grazie
              </button>
              <button
                onClick={handleInstallClick}
                className="text-xs px-3 py-1.5 rounded-md bg-sky-600 text-white hover:bg-sky-700"
              >
                Installa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner iOS/Safari */}
      {showIosBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-[100]">
          <div className="rounded-2xl border shadow-lg bg-white p-3">
            <div className="flex items-start gap-3">
              <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-md" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Aggiungi “Ore App” alla Home</p>
                <ol className="mt-1 text-xs text-slate-700 list-decimal pl-4 space-y-1">
                  <li>Premi il tasto <span className="font-medium">Condividi</span> di Safari (freccia verso l’alto).</li>
                  <li>Seleziona <span className="font-medium">“Aggiungi alla schermata Home”</span>.</li>
                </ol>
              </div>
              <button
                onClick={handleClose}
                className="ml-auto text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
