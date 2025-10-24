/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
// components/InstallPromptBanner.tsx
"use client";
import { useEffect, useState } from "react";

export default function InstallPromptBanner() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
  };

  if (!visible) return null;
  return (
    <div className="fixed bottom-4 inset-x-0 flex justify-center z-50">
      <div className="max-w-md w-full mx-4 p-4 rounded-2xl shadow-xl border bg-white">
        <div className="font-semibold mb-1">Installa Ore App</div>
        <p className="text-sm text-gray-600 mb-3">
          Aggiungi l'app alla schermata Home o al desktop per usarla a schermo intero e offline.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="px-3 py-1.5 rounded-lg border" onClick={() => setVisible(false)}>Annulla</button>
          <button className="px-3 py-1.5 rounded-lg border bg-black text-white" onClick={install}>Installa</button>
        </div>
      </div>
    </div>
  );
}
