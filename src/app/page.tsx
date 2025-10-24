/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */

"use client";

import Lottie from "lottie-react";
import loginAnim from "@/animations/cleaner.json";
import userAnim from "@/animations/cleaner.json";
import React, { useEffect, useMemo, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { WORKERS } from "./workers";

const GAS_ENDPOINT =
  process.env.NEXT_PUBLIC_GAS_ENDPOINT ||
  "https://script.google.com/macros/s/AKfycbx2cyiFykEvzA5NcRK5Cr2lb4EMOHoJUG7CWJkh06HUUEoKsMzB_wqpcZPZ0vomnIqKjw/exec";

const PREVIEW_PROXY =
  process.env.NEXT_PUBLIC_PREVIEW_PROXY ||
  "https://script.google.com/macros/s/AKfycby6yubXKGcNRdC-mmHYM5-yRhhT9Ftsk6pSMX5Txig7JZ25uwNOoWdSnV0gL8OeGEyQ6A/exec";

const SHEET_NAME = "STRAORDINARIO E GIUSTIFICATIVI";
const PRESENZE_TAB = "FOGLIO PRESENZE DIGITALE";
const SECRET = "CAMBIA-MI";

// giustificativi
const GIUSTIFICATIVI = ["F", "ROL", "M", "FES", "FP", "L104", "R"] as const;
const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const OT_PREFIX = "Straordinario ore ";
const PROT_PREFIX = "Protocollo malattia n° ";

/* ===== UTILS ===== */
function toA1(col: string, row: number) {
  return `${SHEET_NAME}!${col}${row}`;
}
function isValidOvertime(v: string) {
  return /^\d+(\.\d{2})?$/.test(v);
}
function weekdayKey(d: Date) {
  return DOW_KEYS[d.getDay()];
}
function isGiustificativo(v?: string | null) {
  if (!v) return false;
  return GIUSTIFICATIVI.includes(v as any);
}
function toYmdLocal(d: Date) {
  const dd = new Date(d.getTime());
  dd.setHours(12, 0, 0, 0);
  const iso = new Date(dd.getTime() - dd.getTimezoneOffset() * 60000).toISOString();
  return iso.slice(0, 10);
}

// "8,00" -> 8; "4,50" -> 4.5
function parseHoursComma(h?: string | null): number | null {
  if (!h) return null;
  if (!/^\d+(,\d{2})?$/.test(h)) return null;
  return Number(h.replace(",", "."));
}

// somma ore decimali ad un orario "HH:MM" -> "HH:MM"
function addDecHours(startHHMM: string, hoursDec: number): string {
  const [hh, mm] = startHHMM.split(":").map((n) => parseInt(n, 10));
  const startMin = hh * 60 + (mm || 0);
  const addMin = Math.round(hoursDec * 60);
  let tot = startMin + addMin;
  tot = ((tot % (24 * 60)) + (24 * 60)) % (24 * 60);
  const H = Math.floor(tot / 60);
  const M = tot % 60;
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
}

// orario contrattuale predefinito per quella data
function getDefaultOrdForDate(profile: any, date: Date): string | undefined {
  const key = weekdayKey(date);
  const h = profile?.schedule?.[key];
  if (!h) return undefined;
  return h === "0,00" ? undefined : h;
}

function getDefaultTimesForDate(profile: any, date: Date): { start: string; end: string } {
  const dow = weekdayKey(date);
  const preset = profile?.times?.[dow] as { start?: string; end?: string } | undefined;
  if (preset?.start && preset?.end) return { start: preset.start, end: preset.end };
  const ord = getDefaultOrdForDate(profile, date);
  const dec = parseHoursComma(ord || "");
  if (dec && Math.abs(dec - 5) < 0.01) return { start: "13:00", end: "18:00" };
  if (dec) {
    const start = "08:00";
    return { start, end: addDecHours(start, dec) };
  }
  return { start: "", end: "" };
}

/** Badge giustificativo */
function giustificativoBadge(v?: string | null): { label: string; className: string } | null {
  switch (v) {
    case "F":   return { label: "Ferie",            className: "bg-blue-100 text-blue-700" };
    case "M":   return { label: "Malattia",         className: "bg-green-100 text-green-700" };
    case "ROL": return { label: "Permesso ROL",     className: "bg-sky-100 text-sky-700" };
    case "L104":return { label: "Legge 104",        className: "bg-orange-100 text-orange-700" };
    case "FES": return { label: "Festivo",          className: "bg-red-100 text-red-700" };
    case "FP":  return { label: "Festa patronale",  className: "bg-rose-100 text-rose-700" };
    case "R":   return { label: "Riposo",           className: "bg-gray-100 text-gray-700" };
    default:    return null;
  }
}

/* ===== LOGIN ===== */
function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onLoggedIn();
    } catch (error: any) {
      setErr(error?.message ?? "Errore di accesso");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-xl rounded-2xl">
        <CardContent className="p-8 space-y-6">
          <div className="flex justify-center">
            <img
              src="https://cleanservicesrl.it/images/logo.png"
              alt="Clean Service Logo"
              className="h-16 md:h-20 object-contain"
            />
          </div>

          <h1 className="text-2xl font-semibold text-center">Accesso</h1>
          <Lottie animationData={loginAnim} loop autoplay style={{ width: 200, margin: "0 auto" }} />

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm">Email</label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Password</label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button type="submit" className="w-full">Entra</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ===== PAGINA LAVORATORE ===== */
function WorkerPage({ userEmail }: { userEmail: string }) {
  const profilo = WORKERS[userEmail];

  // mese corrente (12:00)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12, 0, 0, 0);
  const monthStartISO = new Date(monthStart.getTime() - monthStart.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const monthEndISO = new Date(monthEnd.getTime() - monthEnd.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  // state
  const [today, setToday] = useState(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [ordinario, setOrdinario] = useState<string | undefined>(() =>
    getDefaultOrdForDate(profilo, new Date())
  );
  const [manualMode, setManualMode] = useState(false);
  const [manualHours, setManualHours] = useState<string>("");

  const [startTime, setStartTime] = useState<string>(() => getDefaultTimesForDate(profilo, new Date()).start);
  const [endTime, setEndTime] = useState<string>(() => getDefaultTimesForDate(profilo, new Date()).end);

  const [sedeStraord, setSedeStraord] = useState<string>("Corte D'Appello");
  const [straordinario, setStraordinario] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dateErr, setDateErr] = useState<string | null>(null);

  // overlay salvataggio
  const [saving, setSaving] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saveOk, setSaveOk] = useState(false);

  // overlay ANTEPRIMA fullscreen
  const [showPreview, setShowPreview] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  // overlay elaborazione anteprima
  const [previewProcessing, setPreviewProcessing] = useState(false);
  const [previewElapsedMs, setPreviewElapsedMs] = useState(0);

  // Zoom (50%–200%)
  const [zoomPct, setZoomPct] = useState(100);
  const minZoom = 50;
  const maxZoom = 200;
  const stepZoom = 10;
  const applyZoom = (v: number) => setZoomPct(Math.min(maxZoom, Math.max(minZoom, Math.round(v))));

  // riga foglio personale
  const riga = useMemo(() => 4 + today.getDate(), [today]);

  // regex
  const timeRe = useMemo(() => /^([01]\d|2[0-3]):[0-5]\d$/, []);
  const overtimeRangeRe = useMemo(
    () => /^straordinario ore\s*([01]\d|2[0-3]):[0-5]\d\s*[-–]\s*([01]\d|2[0-3]):[0-5]\d/i,
    []
  );
  const protocolRe = useMemo(() => /^protocollo malattia n°\s*\d{9}$/i, []);

  // blocca scroll quando overlay preview aperto
  useEffect(() => {
    if (showPreview) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [showPreview]);

  // chiudi overlay con ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowPreview(false);
    }
    if (showPreview) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPreview]);

  // al mount: forza la data nel mese
  useEffect(() => {
    if (today < monthStart) setToday(new Date(monthStart));
    if (today > monthEnd) setToday(new Date(monthEnd));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // quando scelgo un giustificativo azzero straordinario
  useEffect(() => {
    if (isGiustificativo(ordinario)) setStraordinario("");
  }, [ordinario]);

  const giust = isGiustificativo(ordinario);

  // NOTE dinamiche
  useEffect(() => {
    if (ordinario === "M") {
      if (!note.toLowerCase().startsWith(PROT_PREFIX.toLowerCase())) setNote(PROT_PREFIX);
      return;
    }
    if (giust) {
      if (note !== "") setNote("");
      return;
    }
    if (!straordinario) {
      if (note !== "") setNote("");
      return;
    }
    if (!note.toLowerCase().startsWith(OT_PREFIX.toLowerCase())) setNote(OT_PREFIX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordinario, giust, straordinario]);

  // VALIDAZIONI
  const manualHoursError = useMemo(() => {
    if (!(manualMode && !giust)) return null;
    if (!manualHours) return "Inserisci le ore (formato H,MM — es. 7,00).";
    if (!/^\d+(,\d{2})$/.test(manualHours)) return "Formato ore non valido. Usa la virgola e due decimali (es. 7,00).";
    return null;
  }, [manualMode, giust, manualHours]);

  const timesError = useMemo(() => {
    if (!(manualMode && !giust)) return null;
    const inOk = !!startTime && timeRe.test(startTime);
    const outOk = !!endTime && timeRe.test(endTime);
    if (!inOk || !outOk) return "Compila ora INIZIO e FINE nel formato HH:MM.";
    return null;
  }, [manualMode, giust, startTime, endTime, timeRe]);

  const overtimeNotesError = useMemo(() => {
    if (!straordinario || giust || ordinario === "M") return null;
    if (!note || !overtimeRangeRe.test(note)) {
      return 'Con ore straordinario inserite, scrivi nelle note: "Straordinario ore HH:MM-HH:MM".';
    }
    return null;
  }, [straordinario, giust, ordinario, note, overtimeRangeRe]);

  const protocolError = useMemo(() => {
    if (ordinario !== "M") return null;
    if (!note || !protocolRe.test(note)) {
      return 'Inserisci il numero: "Protocollo malattia n° 123456789" (9 cifre).';
    }
    return null;
  }, [ordinario, note, protocolRe]);

  const hasBlockingErrors = !!(manualHoursError || timesError || overtimeNotesError || protocolError);

  // timer overlay salvataggio
  useEffect(() => {
    if (!saving) return;
    setElapsedMs(0);
    const start = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [saving]);

  // timer overlay anteprima
  useEffect(() => {
    if (!previewProcessing) return;
    setPreviewElapsedMs(0);
    const start = Date.now();
    const id = setInterval(() => setPreviewElapsedMs(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [previewProcessing]);

  // ==== SALVA ====
  async function inviaDati() {
    try {
      setErr(null);
      setStatus(null);
      setSaveOk(false);
      setSaving(true);

      if (today < monthStart || today > monthEnd) {
        setErr("Puoi salvare solo per il mese corrente.");
        setSaving(false);
        return;
      }

      let valueOrdinario: string | undefined = ordinario;

      if (manualMode && !giust) {
        if (manualHoursError || timesError) {
          setErr("Compila correttamente ore (H,MM) e orari (HH:MM).");
          setSaving(false);
          return;
        }
        valueOrdinario = manualHours;
      }

      if (ordinario === "M") {
        if (protocolError) {
          setErr('Inserisci il numero: "Protocollo malattia n° 123456789" (9 cifre).');
          setSaving(false);
          return;
        }
      }

      if (straordinario) {
        if (giust || ordinario === "M") {
          setErr("Con un giustificativo selezionato non puoi inserire ore di straordinario.");
          setSaving(false);
          return;
        }
        if (overtimeNotesError) {
          setErr('Con ore straordinario inserite, scrivi nelle note: "Straordinario ore HH:MM-HH:MM".');
          setSaving(false);
          return;
        }
        if (!isValidOvertime(straordinario)) {
          setErr("Formato straordinario non valido. Usa es. 0.30, 1.00, 1.30");
          setSaving(false);
          return;
        }
      }

      if (!valueOrdinario) {
        setErr("Seleziona un valore per Ordinario/Giustificativo.");
        setSaving(false);
        return;
      }

      // 1) scrive sul foglio personale
      const writes: { range: string; value: any }[] = [];
      const dayRow = 4 + today.getDate();
      writes.push({ range: toA1("D", dayRow), value: valueOrdinario });
      writes.push({ range: toA1("F", 3), value: sedeStraord });
      writes.push({ range: toA1("F", dayRow), value: straordinario || "" });
      writes.push({ range: toA1("L", dayRow), value: note || "" });

      // 2) FOGLIO PRESENZE (solo se non giustificativo)
      if (!giust) {
        const day = today.getDate();
        const rowCE = 11 + day;
        const rangeIn  = `${PRESENZE_TAB}!C${rowCE}`;
        const rangeOut = `${PRESENZE_TAB}!E${rowCE}`;
        const inOk = !!startTime && timeRe.test(startTime);
        const outOk = !!endTime && timeRe.test(endTime);
        if (inOk && outOk) {
          writes.push({ range: rangeIn, value: startTime });
          writes.push({ range: rangeOut, value: endTime });
        } else {
          const def = getDefaultTimesForDate(profilo, today);
          if (timeRe.test(def.start) && timeRe.test(def.end)) {
            writes.push({ range: rangeIn, value: def.start });
            writes.push({ range: rangeOut, value: def.end });
          }
        }
      }

      // invio
      const res = await fetch(GAS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ sheetId: profilo.sheetId, secret: SECRET, writes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Errore sconosciuto lato server");

      // 3) sincronizzazione Piano Ferie
      const ymd = toYmdLocal(today);
      if (valueOrdinario === "F" || valueOrdinario === "ROL") {
        const entry = {
          email: userEmail,
          nome: profilo?.nome || "",
          cognome: profilo?.cognome || "",
          date: ymd,
          tipo: valueOrdinario === "F" ? "FERIE" : "ROL",
          note: note || "",
        };
        const resPlan = await fetch(GAS_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ action: "savePlan", secret: SECRET, entries: [entry] }),
        });
        if (!resPlan.ok) throw new Error(`HTTP ${res.status}`);
        const planJson = await resPlan.json();
        if (!planJson?.ok) throw new Error(planJson?.error || "Errore salvataggio piano");
      } else {
        const resDel = await fetch(GAS_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({
            action: "deletePlan",
            secret: SECRET,
            items: [
              { email: userEmail, date: ymd, tipo: "FERIE" },
              { email: userEmail, date: ymd, tipo: "ROL" },
            ],
          }),
        });
        if (!resDel.ok) throw new Error(`HTTP ${resDel.status}`);
        const delJson = await resDel.json();
        if (!delJson?.ok) throw new Error(delJson?.error || "Errore update piano");
      }

      // successo: spunta
      setSaveOk(true);
      setStatus("Dati salvati correttamente.");
      setTimeout(() => {
        setSaveOk(false);
        setSaving(false);
      }, 1200);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setStatus(null);
      setSaving(false);
      setSaveOk(false);
    }
  }

  async function caricaAnteprimaPdf() {
    try {
      setPreviewProcessing(true);
      setLoadingPreview(true);
      setPreviewErr(null);
      const sheetGid = (profilo as any).sheetGid ?? 0;
      const url = `${PREVIEW_PROXY}?sheetId=${encodeURIComponent(profilo.sheetId)}&gid=${encodeURIComponent(String(sheetGid))}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Errore proxy anteprima");
      const dataUrl = `data:${json.mime};base64,${json.data}`;
      setPreviewSrc(dataUrl);
    } catch (e: any) {
      setPreviewErr(e?.message || String(e));
      setPreviewSrc(null);
    } finally {
      setLoadingPreview(false);
      setTimeout(() => setPreviewProcessing(false), 200);
    }
  }

  if (!profilo) {
    return (
      <div className="min-h-screen grid place-items-center bg-amber-50 p-4">
        <Card className="w-full max-w-xl shadow-xl rounded-2xl">
          <CardContent className="p-8 space-y-4">
            <h2 className="text-xl font-semibold">Utente non configurato</h2>
            <p className="text-slate-600">
              Aggiungi l'email <span className="font-mono">{userEmail}</span> nella mappa WORKERS nel codice.
            </p>
            <Button onClick={() => signOut(auth)}>Esci</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const badge = giustificativoBadge(ordinario);
  const seconds = (elapsedMs / 1000).toFixed(1);
  const previewSeconds = (previewElapsedMs / 1000).toFixed(1);
  const iframeSrc = previewSrc ? `${previewSrc}#zoom=${zoomPct}` : undefined;

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b shadow-sm">
  <div className="p-4 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold">Foglio Presenze</h1>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <Button variant="secondary" onClick={() => (window.location.href = "/ferie")} className="w-full sm:w-auto">
          Piano Ferie
        </Button>
        <div className="text-left sm:text-right">
          <p className="text-sm">{profilo.nome} {profilo.cognome}</p>
          <p className="text-xs text-slate-500 break-all">{userEmail}</p>
        </div>
        <Button variant="secondary" onClick={() => signOut(auth)} className="w-full sm:w-auto">
          Esci
        </Button>
      </div>
    </div>
  </div>
</header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* LOGO */}
              <div className="flex justify-center">
                <img
                  src="https://cleanservicesrl.it/images/logo.png"
                  alt="Clean Service Logo"
                  className="h-12 sm:h-16 md:h-20 object-contain"
                />
              </div>
              {/* Animazione */}
              <div className="mx-auto w-32 sm:w-48">
                <Lottie animationData={userAnim} loop autoplay />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <p className="text-base sm:text-lg font-medium">
                    {profilo.nome} {profilo.cognome}
                  </p>
                  <p className="text-sm text-slate-600">Sede di lavoro: {profilo.sedeBase}</p>
                </div>

                {/* Data */}
                <div className="text-left sm:text-right">
                  <label className="text-sm text-slate-600">Data</label>
                  <Input
                    className="w-full sm:w-auto"
                    type="date"
                    min={monthStartISO}
                    max={monthEndISO}
                    value={new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10)}
                    onChange={(e) => {
                      const iso = e.target.value;
                      if (!iso) return;
                      const d = new Date(iso + "T12:00:00");

                      if (d < monthStart || d > monthEnd) {
                        setDateErr("Puoi inserire solo giorni del mese corrente.");
                        e.currentTarget.value = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
                          .toISOString()
                          .slice(0, 10);
                        return;
                      }

                      setDateErr(null);
                      setToday(d);

                      if (!isGiustificativo(ordinario)) {
                        const defOrd = getDefaultOrdForDate(profilo, d);
                        setOrdinario((prev) => defOrd ?? prev);
                        const defTimes = getDefaultTimesForDate(profilo, d);
                        setStartTime(defTimes.start);
                        setEndTime(defTimes.end);
                      }
                    }}
                  />
                  {dateErr && <p className="text-xs text-red-600 mt-1">{dateErr}</p>}
                  <p className="text-[11px] text-slate-500 mt-1">Compilabile dal {monthStartISO} al {monthEndISO}.</p>
                </div>
              </div>

              {/* Ordinario/Giustificativo + Inserimento manuale ore */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-slate-600">Ordinario / Giustificativo</label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <Select
                      value={manualMode ? "MANUALE" : (ordinario || undefined)}
                      onValueChange={(val) => {
                        if (val === "MANUALE") {
                          setManualMode(true);
                          setOrdinario(undefined);
                          setStraordinario("");
                          setManualHours("");
                          setStartTime("");
                          setEndTime("");
                          return;
                        }
                        setManualMode(false);
                        setManualHours("");
                        setOrdinario(val);
                        const giustSel = isGiustificativo(val);
                        if (giustSel) {
                          setStraordinario("");
                        } else {
                          const defTimes = getDefaultTimesForDate(profilo, today);
                          setStartTime(defTimes.start);
                          setEndTime(defTimes.end);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Seleziona…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const def = getDefaultOrdForDate(profilo, today);
                          return def ? <SelectItem key={`def-${def}`} value={def}>{def}</SelectItem> : null;
                        })()}
                        <SelectItem value="MANUALE">Inserisci ore manualmente…</SelectItem>
                        <SelectItem value="F">F</SelectItem>
                        <SelectItem value="ROL">ROL</SelectItem>
                        <SelectItem value="M">M</SelectItem>
                        <SelectItem value="FES">FES</SelectItem>
                        <SelectItem value="FP">FP</SelectItem>
                        <SelectItem value="L104">L104</SelectItem>
                        <SelectItem value="R">R</SelectItem>
                      </SelectContent>
                    </Select>

                    {!manualMode && badge && (
                      <span className={`text-xs sm:text-sm font-medium px-3 py-1 rounded-full ${badge.className}`} aria-live="polite">
                        {badge.label}
                      </span>
                    )}
                  </div>

                  {manualMode && (
                    <div className="mt-2">
                      <label className="text-xs text-slate-600">Ore (usa la virgola, es. 7,00)</label>
                      <Input
                        className="w-full"
                        placeholder="es. 7,00"
                        value={manualHours}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^\d*(,\d{0,2})?$/.test(v)) setManualHours(v);
                        }}
                        inputMode="decimal"
                      />
                      {manualHoursError && <p className="text-xs text-red-600 mt-1">{manualHoursError}</p>}
                    </div>
                  )}
                </div>

                {/* Orari */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600">Ora inizio ordinario</label>
                    <Input
                      className="w-full"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      disabled={giust}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600">Ora fine ordinario</label>
                    <Input
                      className="w-full"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      disabled={giust}
                    />
                  </div>
                  {timesError && <div className="sm:col-span-2"><p className="text-xs text-red-600">{timesError}</p></div>}
                </div>
              </div>

              {/* Sede + straordinario */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-slate-600">Sede dello straordinario</label>
                  <Select onValueChange={setSedeStraord} value={sedeStraord}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Corte D'Appello", "Arpa", "CNR", "Altro"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-600">Ore straordinario (formato 0.30)</label>
                  <Input
                    className="w-full"
                    placeholder={giust ? "Disabilitato: è presente un giustificativo" : "es. 1.30"}
                    value={straordinario}
                    disabled={giust}
                    onChange={(e) => setStraordinario(e.target.value)}
                  />
                </div>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <label className="text-sm text-slate-600">
                  {ordinario === "M"
                    ? "Note — inserisci il numero di protocollo (9 cifre)"
                    : straordinario
                    ? 'Note — scrivi dopo il prefisso la fascia "HH:MM-HH:MM"'
                    : "Note"}
                </label>
                <Textarea
                  className="w-full"
                  placeholder={
                    ordinario === "M"
                      ? "Protocollo malattia n° 123456789"
                      : straordinario
                      ? "Straordinario ore 18:30-20:00 (esempio)"
                      : "Collega sostituito, protocollo malattia, …"
                  }
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {protocolError && <p className="text-xs text-red-600">{protocolError}</p>}
                {!protocolError && overtimeNotesError && (
                  <p className="text-xs text-red-600">{overtimeNotesError}</p>
                )}
              </div>

              {/* Azioni – DESKTOP/TABLET (>= sm) */}
              <div className="hidden sm:flex flex-wrap items-center gap-2 sm:gap-3 pt-2">
                <Button onClick={inviaDati} disabled={hasBlockingErrors || saving}>
                  Salva nel foglio
                </Button>

                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (!showPreview) {
                      setZoomPct(100);
                      await caricaAnteprimaPdf();
                      setShowPreview(true);
                    } else {
                      setShowPreview(false);
                    }
                  }}
                  disabled={saving}
                >
                  {showPreview ? "Chiudi anteprima" : "Mostra anteprima"}
                </Button>

                <Button variant="secondary" onClick={() => (window.location.href = "/ferie")} disabled={saving}>
                  Piano Ferie
                </Button>

                {status && <span className="text-sm text-emerald-600">{status}</span>}
                {err && <span className="text-sm text-red-600">{err}</span>}
              </div>

              {/* Spacer per non coprire contenuto su mobile */}
              <div className="h-20 sm:hidden" />
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Action bar MOBILE (< sm) fissa in basso */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 border-t shadow-lg">
        <div className="px-3 py-2 grid grid-cols-3 gap-2">
          <Button
            size="sm"
            onClick={inviaDati}
            disabled={hasBlockingErrors || saving}
            className="w-full"
          >
            Salva
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              if (!showPreview) {
                setZoomPct(100);
                await caricaAnteprimaPdf();
                setShowPreview(true);
              } else {
                setShowPreview(false);
              }
            }}
            disabled={saving}
            className="w-full"
          >
            Anteprima
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => (window.location.href = "/ferie")}
            disabled={saving}
            className="w-full"
          >
            Ferie
          </Button>
        </div>

        <div className="px-3 pb-2">
          {status && <span className="text-xs text-emerald-600">{status}</span>}
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>
      </div>

      {/* Overlay Salvataggio */}
      {(saving || saveOk) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-[90%] max-w-sm text-center">
            {!saveOk ? (
              <>
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
                <p className="text-lg font-medium">Elaborazione…</p>
                <p className="text-sm text-slate-600 mt-1">Tempo: {seconds}s</p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 h-12 w-12 rounded-full grid place-items-center bg-emerald-100">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-600">
                    <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-emerald-700">Dati salvati!</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay ANTEPRIMA FULLSCREEN */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/60 backdrop-blur-sm">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-white/95 border-b">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm sm:text-base font-medium">Anteprima foglio (PDF)</span>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="h-8 px-2"
                onClick={() => applyZoom(zoomPct - stepZoom)}
                disabled={!previewSrc}
                title="Zoom out"
              >
                −
              </Button>
              <Button
                variant="secondary"
                className="h-8 px-3"
                onClick={() => applyZoom(100)}
                disabled={!previewSrc}
                title="Reset zoom"
              >
                {zoomPct}%
              </Button>
              <Button
                variant="secondary"
                className="h-8 px-2"
                onClick={() => applyZoom(zoomPct + stepZoom)}
                disabled={!previewSrc}
                title="Zoom in"
              >
                +
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {previewSrc && (
                <a href={previewSrc} download="anteprima.pdf" className="text-sm underline">
                  Scarica PDF
                </a>
              )}
              <Button variant="secondary" onClick={() => setShowPreview(false)} className="py-1 h-9">
                ✕ Chiudi
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-2 sm:p-4">
            <div className="w-full h-full bg-white rounded-lg overflow-hidden shadow relative">
              {previewSrc && !previewErr && (
                <iframe
                  key={zoomPct}
                  src={iframeSrc}
                  className="w-full h-[calc(100vh-64px-16px)] sm:h-[calc(100vh-64px-24px)]"
                  title="Anteprima foglio (PDF)"
                />
              )}

              {!previewSrc && !previewErr && (
                <div className="w-full h-full grid place-items-center p-4">
                  <p className="text-sm text-slate-600">Nessuna anteprima disponibile.</p>
                </div>
              )}

              {previewErr && (
                <div className="w-full h-full grid place-items-center p-4">
                  <div className="text-center">
                    <p className="text-sm text-red-600">Errore anteprima: {previewErr}</p>
                    <div className="mt-3">
                      <Button variant="secondary" onClick={() => { void caricaAnteprimaPdf(); }}>
                        Riprova
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Overlay elaborazione anteprima */}
          {(previewProcessing || loadingPreview) && (
            <div className="fixed inset-0 z-[70] grid place-items-center bg-black/30 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-[90%] max-w-sm text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
                <p className="text-lg font-medium">Elaborazione anteprima…</p>
                <p className="text-sm text-slate-600 mt-1">Tempo: {previewSeconds}s</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ===== ROOT APP ===== */
export default function App() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserEmail(user?.email?.toLowerCase() ?? null);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) return <div className="min-h-screen grid place-items-center text-slate-500 p-4">Caricamento…</div>;
  if (!userEmail) return <Login onLoggedIn={() => void 0} />;
  return <WorkerPage userEmail={userEmail} />;
}
