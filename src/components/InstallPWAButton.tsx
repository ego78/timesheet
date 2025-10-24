// components/InstallPWAButton.tsx
"use client";
import { useEffect, useState } from "react";

export default function InstallPWAButton() {
  const [deferred, setDeferred] = useState<any>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setSupported(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setDeferred(null);
  };

  if (!supported) return null;
  return (
    <button className="px-4 py-2 rounded-xl shadow border hover:bg-gray-50" onClick={install}>
      Installa l'app
    </button>
  );
}
