/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */

"use client";

import React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { WORKERS } from "../workers";

const GAS_ENDPOINT =
  process.env.NEXT_PUBLIC_GAS_ENDPOINT ||
  "https://script.google.com/macros/s/AKfycbwTOf7NK_VIpjqVU7-tyZBRECNCfG2089JJCnNT4zVnJfqOFp6c96fa5AAmbm80RQ0NPw/exec";

const SECRET = "CAMBIA-MI";

type PlanRow = {
  sheet: string;
  rowIndex: number;
  email: string;
  nome: string;
  cognome: string;
  date: string; // yyyy-MM-dd
  tipo: string; // FERIE | ROL
  note: string;
  timestamp?: string;
};

const rowKey = (r: PlanRow) => `${r.date}|${r.tipo}`;

/* ===== Helpers numerici ===== */
function parseNum(input: string): number | null {
  if (!input) return null;
  const n = Number(String(input).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function toYmd(d: Date) {
  const dd = new Date(d.getTime());
  dd.setHours(12, 0, 0, 0);
  const iso = new Date(dd.getTime() - dd.getTimezoneOffset() * 60000).toISOString();
  return iso.slice(0, 10);
}
function isInCurrentMonth(ymd: string) {
  const now = new Date();
  const d = new Date(ymd + "T12:00:00");
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function isInFutureMonths(ymd: string) {
  const now = new Date();
  const firstDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0, 0);
  const d = new Date(ymd + "T12:00:00");
  return d.getTime() >= firstDayNextMonth.getTime();
}

/* Media ore giornaliere dal profilo (solo giorni con ore > 0) */
function averageDailyHoursFromProfile(profile: any): number | null {
  const sched = profile?.schedule || {};
  const keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const hours: number[] = [];
  for (const k of keys) {
    const v = sched[k];
    if (!v) continue;
    const n = parseNum(String(v)); // "8,00" -> 8
    if (n !== null && n > 0) hours.push(n);
  }
  if (hours.length === 0) return null;
  const sum = hours.reduce((a, b) => a + b, 0);
  return sum / hours.length;
}

export default function PianoFeriePage() {
  // ---------- STATE ----------
  const [selected, setSelected] = React.useState<Date[]>([]);
  const [tipo, setTipo] = React.useState<"FERIE" | "ROL">("FERIE");
  const [note, setNote] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(true);

  const [status, setStatus] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const [existing, setExisting] = React.useState<PlanRow[]>([]);
  const [loadingExisting, setLoadingExisting] = React.useState(false);
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());

  // Proiezioni & ore contratto
  const [projFerieHours, setProjFerieHours] = React.useState<string>("");
  const [projRolHours, setProjRolHours] = React.useState<string>("");
  const [hoursPerDay, setHoursPerDay] = React.useState<string>("");

  // init ore giornaliere una sola volta
  const initializedHoursRef = React.useRef(false);

  // overlay salvataggio
  const [saving, setSaving] = React.useState(false);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [saveOk, setSaveOk] = React.useState(false);

  // ---------- EFFECTS ----------
  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setEmail(u?.email ? u.email.toLowerCase() : "");
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    if (!authLoading && !email) {
      if (typeof window !== "undefined") window.location.href = "/";
    }
  }, [authLoading, email]);

  const profilo = React.useMemo(() => WORKERS[(email || "").trim().toLowerCase()], [email]);

  React.useEffect(() => {
    if (!initializedHoursRef.current && profilo) {
      const avg = averageDailyHoursFromProfile(profilo);
      if (avg !== null) {
        setHoursPerDay(String(avg));
        initializedHoursRef.current = true;
      }
    }
  }, [profilo]);

  // timer overlay salvataggio
  React.useEffect(() => {
    if (!saving) return;
    setElapsedMs(0);
    const start = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [saving]);

  async function loadExisting() {
    if (!email) return;
    try {
      setLoadingExisting(true);
      setErr(null);
      const year = new Date().getFullYear();

      const [listRes, balRes] = await Promise.all([
        fetch(GAS_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ action: "listPlan", secret: SECRET, email, year }),
        }),
        fetch(GAS_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ action: "getBalances", secret: SECRET, email }),
        }),
      ]);

      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      if (!balRes.ok) throw new Error(`HTTP ${balRes.status}`);

      const listJson = await listRes.json();
      const balJson = await balRes.json();

      if (!listJson?.ok) throw new Error(listJson?.error || "Errore listPlan");
      if (!balJson?.ok) throw new Error(balJson?.error || "Errore getBalances");

      const rows: PlanRow[] = listJson.data || [];
      rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setExisting(rows);
      setSelectedKeys(new Set());

      const bal = balJson.data;
      if (bal) {
        setProjFerieHours(String(bal.oreFerie ?? ""));
        setProjRolHours(String(bal.oreRol ?? ""));
        if (bal.oreGiornaliere !== undefined && bal.oreGiornaliere !== null && bal.oreGiornaliere > 0) {
          setHoursPerDay(String(bal.oreGiornaliere));
          initializedHoursRef.current = true;
        } else {
          const avg = averageDailyHoursFromProfile(profilo);
          if (avg !== null) {
            setHoursPerDay(String(avg));
            initializedHoursRef.current = true;
          } else {
            setHoursPerDay("8");
            initializedHoursRef.current = true;
          }
        }
      } else {
        const avg = averageDailyHoursFromProfile(profilo);
        setHoursPerDay(String(avg ?? 8));
        initializedHoursRef.current = true;
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoadingExisting(false);
    }
  }

  React.useEffect(() => {
    if (!authLoading && email) loadExisting();
  }, [authLoading, email]);

  // ---------- PROIEZIONI ----------
  const selectedYmds = React.useMemo(() => selected.map(toYmd), [selected]);

  const selectedCurrentMonthFerie = React.useMemo(() => {
    const set = new Set<string>();
    if (tipo === "FERIE") selectedYmds.forEach((ymd) => { if (isInCurrentMonth(ymd)) set.add(ymd); });
    return set;
  }, [selectedYmds, tipo]);

  const selectedCurrentMonthRol = React.useMemo(() => {
    const set = new Set<string>();
    if (tipo === "ROL") selectedYmds.forEach((ymd) => { if (isInCurrentMonth(ymd)) set.add(ymd); });
    return set;
  }, [selectedYmds, tipo]);

  const existingCurrentMonthFerie = React.useMemo(() => {
    const set = new Set<string>();
    existing.forEach((r) => { if (r.tipo === "FERIE" && isInCurrentMonth(r.date)) set.add(r.date); });
    return set;
  }, [existing]);

  const existingCurrentMonthRol = React.useMemo(() => {
    const set = new Set<string>();
    existing.forEach((r) => { if (r.tipo === "ROL" && isInCurrentMonth(r.date)) set.add(r.date); });
    return set;
  }, [existing]);

  const ferieCurrentMonthCount = React.useMemo(() => {
    const u = new Set<string>([...existingCurrentMonthFerie, ...selectedCurrentMonthFerie]);
    return u.size;
  }, [existingCurrentMonthFerie, selectedCurrentMonthFerie]);

  const rolCurrentMonthCount = React.useMemo(() => {
    const u = new Set<string>([...existingCurrentMonthRol, ...selectedCurrentMonthRol]);
    return u.size;
  }, [existingCurrentMonthRol, selectedCurrentMonthRol]);

  const selectedFutureMonthsFerie = React.useMemo(() => {
    const set = new Set<string>();
    if (tipo === "FERIE") selectedYmds.forEach((ymd) => { if (isInFutureMonths(ymd)) set.add(ymd); });
    return set;
  }, [selectedYmds, tipo]);

  const selectedFutureMonthsRol = React.useMemo(() => {
    const set = new Set<string>();
    if (tipo === "ROL") selectedYmds.forEach((ymd) => { if (isInFutureMonths(ymd)) set.add(ymd); });
    return set;
  }, [selectedYmds, tipo]);

  const existingFutureMonthsFerie = React.useMemo(() => {
    const set = new Set<string>();
    existing.forEach((r) => { if (r.tipo === "FERIE" && isInFutureMonths(r.date)) set.add(r.date); });
    return set;
  }, [existing]);

  const existingFutureMonthsRol = React.useMemo(() => {
    const set = new Set<string>();
    existing.forEach((r) => { if (r.tipo === "ROL" && isInFutureMonths(r.date)) set.add(r.date); });
    return set;
  }, [existing]);

  const feriePlannedTotal = React.useMemo(() => {
    const u = new Set<string>([
      ...existingCurrentMonthFerie,
      ...selectedCurrentMonthFerie,
      ...existingFutureMonthsFerie,
      ...selectedFutureMonthsFerie,
    ]);
    return u.size;
  }, [
    existingCurrentMonthFerie,
    selectedCurrentMonthFerie,
    existingFutureMonthsFerie,
    selectedFutureMonthsFerie,
  ]);

  const rolPlannedTotal = React.useMemo(() => {
    const u = new Set<string>([
      ...existingCurrentMonthRol,
      ...selectedCurrentMonthRol,
      ...existingFutureMonthsRol,
      ...selectedFutureMonthsRol,
    ]);
    return u.size;
  }, [
    existingCurrentMonthRol,
    selectedCurrentMonthRol,
    existingFutureMonthsRol,
    selectedFutureMonthsRol,
  ]);

  const ferieDaysRemaining = React.useMemo(() => {
    const h = parseNum(projFerieHours);
    const hpd = parseNum(hoursPerDay);
    if (h === null || hpd === null || hpd <= 0) return null;
    const raw = h / hpd - feriePlannedTotal;
    return Number.isFinite(raw) ? raw : null;
  }, [projFerieHours, hoursPerDay, feriePlannedTotal]);

  const rolDaysRemaining = React.useMemo(() => {
    const h = parseNum(projRolHours);
    const hpd = parseNum(hoursPerDay);
    if (h === null || hpd === null || hpd <= 0) return null;
    const raw = h / hpd - rolPlannedTotal;
    return Number.isFinite(raw) ? raw : null;
  }, [projRolHours, hoursPerDay, rolPlannedTotal]);

  // ---------- ACTIONS ----------
  async function salvaPiano() {
    try {
      setErr(null);
      setStatus(null);
      setSaveOk(false);
      setSaving(true);

      if (!email) throw new Error("Utente non loggato.");
      if (selected.length === 0) throw new Error("Seleziona almeno un giorno.");

      // 1) Piano FERIE/ROL
      const prof = WORKERS[(email || "").trim().toLowerCase()];
      const entries = selected
        .slice()
        .sort((a, b) => a.getTime() - b.getTime())
        .map((d) => ({
          email,
          nome: prof?.nome || "",
          cognome: prof?.cognome || "",
          date: format(d, "yyyy-MM-dd"),
          tipo,
          note: note || "",
        }));

      const resPlan = await fetch(GAS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ action: "savePlan", secret: SECRET, entries }),
      });
      if (!resPlan.ok) throw new Error(`HTTP ${resPlan.status}`);
      const planJson = await resPlan.json();
      if (!planJson?.ok) throw new Error(planJson?.error || "Errore salvataggio piano");

      // 2) Situazione ore (upsert)
      const oreFerie = parseNum(projFerieHours) ?? 0;
      const oreRol = parseNum(projRolHours) ?? 0;
      const oreGiornaliere = parseNum(hoursPerDay) ?? averageDailyHoursFromProfile(prof) ?? 8;

      const resBal = await fetch(GAS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          action: "saveBalances",
          secret: SECRET,
          email,
          oreFerie,
          oreRol,
          oreGiornaliere,
        }),
      });
      if (!resBal.ok) throw new Error(`HTTP ${resBal.status}`);
      const balJson = await resBal.json();
      if (!balJson?.ok) throw new Error(balJson?.error || "Errore salvataggio situazione");

      setStatus(`Piano salvato: ${entries.length} riga/e. Situazione aggiornata.`);
      setSelected([]);
      await loadExisting();

      setSaveOk(true);
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

  function toggleRow(r: PlanRow) {
    const k = rowKey(r);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selectedKeys.size === existing.length && existing.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(existing.map(rowKey)));
    }
  }
  async function deleteSelected() {
    try {
      setErr(null);
      if (selectedKeys.size === 0) return;
      const items = existing
        .filter((r) => selectedKeys.has(rowKey(r)))
        .map((r) => ({ email, date: r.date, tipo: r.tipo }));
      const preview =
        items
          .slice(0, 5)
          .map((i) => `${format(new Date(i.date), "dd/MM/yyyy", { locale: it })} (${i.tipo})`)
          .join(", ") + (items.length > 5 ? ` … +${items.length - 5}` : "");
      const ok = confirm(`Eliminare ${items.length} giorno/i?\n${preview}`);
      if (!ok) return;

      const res = await fetch(GAS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ action: "deletePlan", secret: SECRET, items }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Errore deletePlan");
      await loadExisting();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }
  async function deleteRow(row: PlanRow) {
    try {
      setErr(null);
      const ok = confirm(
        `Eliminare il giorno ${format(new Date(row.date), "dd/MM/yyyy", { locale: it })} (${row.tipo})?`
      );
      if (!ok) return;
      const res = await fetch(GAS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          action: "deletePlan",
          secret: SECRET,
          items: [{ email: (email || "").trim().toLowerCase(), date: row.date, tipo: row.tipo }],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Errore deletePlan");
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(`${row.date}|${row.tipo}`);
        return next;
      });
      await loadExisting();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  // ---------- EARLY RETURNS ----------
  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <p>Verifica accesso…</p>
      </div>
    );
  }
  if (!email) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <p>Reindirizzamento…</p>
      </div>
    );
  }

  const seconds = (elapsedMs / 1000).toFixed(1);

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen bg-white">
      {/* HEADER responsive: bottoni in-line anche su mobile */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b shadow-sm">
        <div className="px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-semibold">Piano Ferie / ROL</h1>
              <p className="hidden sm:block text-sm text-slate-500">
                Seleziona i giorni e salva sul foglio master.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => (window.location.href = "/")}
                className="px-2 whitespace-nowrap"
                disabled={saving}
              >
                ← Torna
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => signOut(auth)}
                className="px-2 whitespace-nowrap"
                disabled={saving}
              >
                Esci
              </Button>
            </div>
          </div>
          <p className="sm:hidden mt-1 text-xs text-slate-500">
            Seleziona i giorni e salva sul foglio master.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
        {/* Inserimento */}
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-4 sm:p-6 space-y-6">
            {/* LOGO SOPRA AL FORM */}
            <div className="flex justify-center">
              <img
                src="https://cleanservicesrl.it/images/logo.png"
                alt="Clean Service Logo"
                className="h-12 sm:h-16 md:h-20 object-contain"
              />
            </div>

            {/* RIGA: email/tipo/note brevi */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Email</label>
                <Input value={email} readOnly className="w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Tipo</label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as "FERIE" | "ROL")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FERIE">Ferie</SelectItem>
                    <SelectItem value="ROL">ROL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Note (opzionale)</label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="es. Piano estivo"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Calendario (selezione multipla)</label>
                <div className="rounded-xl border p-2 sm:p-3 overflow-x-auto">
                  <div className="min-w-[320px]">
                    <DayPicker
                      mode="multiple"
                      locale={it}
                      selected={selected}
                      onSelect={setSelected}
                      showOutsideDays
                      weekStartsOn={1}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-600">Giorni selezionati</label>
                <div className="rounded-xl border p-3 min-h-[220px]">
                  {selected.length === 0 ? (
                    <p className="text-slate-500 text-sm">Nessun giorno selezionato</p>
                  ) : (
                    <ul className="text-sm list-disc pl-5">
                      {selected
                        .slice()
                        .sort((a, b) => a.getTime() - b.getTime())
                        .map((d) => (
                          <li key={d.toISOString()}>
                            {format(d, "EEEE dd/MM/yyyy", { locale: it })}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>

                {/* Proiezioni FERIE / ROL */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="space-y-1">
                    <label className="text-sm text-slate-600">Ore FERIE (da busta)</label>
                    <Input
                      placeholder="es. 56 o 56,5"
                      value={projFerieHours}
                      onChange={(e) => setProjFerieHours(e.target.value)}
                      inputMode="decimal"
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">
                      Giorni mese corrente (FERIE): <b>{ferieCurrentMonthCount}</b>
                    </p>
                    <p className="text-xs text-slate-500">
                      Giorni mesi successivi (FERIE):{" "}
                      <b>{existingFutureMonthsFerie.size + selectedFutureMonthsFerie.size}</b>
                    </p>
                    <p className="text-xs text-slate-500">
                      Totale pianificati (FERIE): <b>{feriePlannedTotal}</b>
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input
                        readOnly
                        value={ferieDaysRemaining === null ? "" : ferieDaysRemaining.toFixed(2)}
                        placeholder="Giorni restanti FERIE"
                        className="w-full sm:w-auto"
                      />
                      {ferieDaysRemaining !== null && ferieDaysRemaining < 0 && (
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs">
                          Attenzione: negativo ({ferieDaysRemaining.toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm text-slate-600">Ore giornaliere da contratto</label>
                    <Input
                      value={hoursPerDay}
                      readOnly
                      className="bg-slate-50 w-full"
                      title="Valore calcolato automaticamente dal profilo o dalla situazione salvata"
                    />
                    <p className="text-xs text-slate-500">
                      Calcolato automaticamente (media dei giorni con ore &gt; 0 nel profilo, oppure dal dato salvato).
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm text-slate-600">Ore ROL (da busta)</label>
                    <Input
                      placeholder="es. 12 o 10,5"
                      value={projRolHours}
                      onChange={(e) => setProjRolHours(e.target.value)}
                      inputMode="decimal"
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">
                      Giorni mese corrente (ROL): <b>{rolCurrentMonthCount}</b>
                    </p>
                    <p className="text-xs text-slate-500">
                      Giorni mesi successivi (ROL):{" "}
                      <b>{existingFutureMonthsRol.size + selectedFutureMonthsRol.size}</b>
                    </p>
                    <p className="text-xs text-slate-500">
                      Totale pianificati (ROL): <b>{rolPlannedTotal}</b>
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input
                        readOnly
                        value={rolDaysRemaining === null ? "" : rolDaysRemaining.toFixed(2)}
                        placeholder="Giorni restanti ROL"
                        className="w-full sm:w-auto"
                      />
                      {rolDaysRemaining !== null && rolDaysRemaining < 0 && (
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs">
                          Attenzione: negativo ({rolDaysRemaining.toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Note estese */}
            <div className="space-y-2">
              <label className="text-sm text-slate-600">Note estese (opzionale)</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note aggiuntive al piano FERIE/ROL"
                className="w-full"
              />
            </div>

            {/* Azioni – DESKTOP/TABLET (>= sm) */}
            <div className="hidden sm:flex flex-wrap items-center gap-2 sm:gap-3">
              <Button onClick={salvaPiano} className="w-auto" disabled={saving}>
                Salva piano
              </Button>
              <Button variant="secondary" onClick={() => setSelected([])} className="w-auto" disabled={saving}>
                Pulisci selezione
              </Button>
              <Button
                variant="outline"
                onClick={loadExisting}
                disabled={loadingExisting || saving}
                className="w-auto"
              >
                {loadingExisting ? "Aggiorno…" : "Ricarica elenco"}
              </Button>
              {status && <span className="text-sm text-emerald-600">{status}</span>}
              {err && <span className="text-sm text-red-600">{err}</span>}
            </div>

            {/* Spacer per non coprire il contenuto su mobile */}
            <div className="h-20 sm:hidden" />
          </CardContent>
        </Card>

        {/* Elenco esistente */}
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <h2 className="text-lg font-medium">Ferie/ROL già comunicati</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600">Selezionati: {selectedKeys.size}</span>
                <Button
                  variant="destructive"
                  onClick={deleteSelected}
                  disabled={selectedKeys.size === 0 || saving}
                  className="w-full sm:w-auto"
                >
                  Elimina selezionati
                </Button>
              </div>
            </div>

            {existing.length === 0 ? (
              <p className="text-sm text-slate-500">Nessuna riga trovata per l'anno corrente.</p>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-3 pl-2 sm:pl-0">
                        <input
                          type="checkbox"
                          aria-label="Seleziona tutto"
                          checked={selectedKeys.size === existing.length && existing.length > 0}
                          onChange={toggleSelectAll}
                          disabled={saving}
                        />
                      </th>
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3">Note</th>
                      <th className="py-2 pr-3">Tab</th>
                      <th className="py-2 pr-3">Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existing.map((r) => {
                      const k = rowKey(r);
                      const checked = selectedKeys.has(k);
                      return (
                        <tr key={`${r.sheet}-${r.rowIndex}`} className="border-b last:border-0">
                          <td className="py-2 pr-3 pl-2 sm:pl-0">
                            <input
                              type="checkbox"
                              aria-label={`Seleziona ${r.date} ${r.tipo}`}
                              checked={checked}
                              onChange={() => toggleRow(r)}
                              disabled={saving}
                            />
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {r.date ? format(new Date(r.date), "dd/MM/yyyy", { locale: it }) : ""}
                          </td>
                          <td className="py-2 pr-3">{r.tipo}</td>
                          <td className="py-2 pr-3 max-w-[280px] truncate">{r.note}</td>
                          <td className="py-2 pr-3 text-slate-500">{r.sheet}</td>
                          <td className="py-2 pr-3">
                            <Button type="button" variant="destructive" size="sm" onClick={() => deleteRow(r)} disabled={saving}>
                              Elimina
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Action bar MOBILE (< sm) fissa in basso */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 border-t shadow-lg">
        <div className="px-3 py-2 grid grid-cols-3 gap-2">
          <Button onClick={salvaPiano} size="sm" className="w-full" disabled={saving}>
            Salva
          </Button>
          <Button variant="secondary" size="sm" className="w-full" onClick={() => setSelected([])} disabled={saving}>
            Pulisci
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={loadExisting}
            disabled={loadingExisting || saving}
          >
            {loadingExisting ? "..." : "Ricarica"}
          </Button>
        </div>

        <div className="px-3 pb-2">
          {status && <span className="text-xs text-emerald-600">{status}</span>}
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>
      </div>

      {/* Overlay Salvataggio con timer + spunta */}
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
                <p className="text-lg font-medium text-emerald-700">Piano salvato!</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
