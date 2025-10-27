"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/app/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  documentId,
  Timestamp,
  getDocs,
} from "firebase/firestore";

/* ===== Tipi ===== */
type DayDoc = {
  ordinary?: number;        // ore ordinarie (decimali)
  overtime?: number;        // ore straordinarie (decimali)
  just?: string | null;     // giustificativo (es. "F", "ROL", "M", ...)
  updatedAt?: Timestamp;
  source?: "app";
};

type Props = {
  userId: string;   // uid Firebase
  yyyymm: string;   // "YYYY-MM"
};

/* ===== Utils ===== */
const DOW_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function fmt(n?: number | null, showZero = false) {
  if (typeof n !== "number" || Number.isNaN(n)) return showZero ? "0,00" : "";
  if (!showZero && Math.abs(n) < 1e-9) return "";
  return n.toFixed(2).replace(".", ",");
}

function monthMeta(yyyymm: string) {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(5, 7)); // 1..12
  const first = new Date(y, m - 1, 1, 12, 0, 0, 0);
  const lastDay = new Date(y, m, 0, 12, 0, 0, 0).getDate();
  // JS: 0=Dom → 0=Lun,...6=Dom
  const mondayIndex = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayIndex + lastDay) / 7) * 7;
  return { y, m, lastDay, mondayIndex, totalCells };
}

function justBadge(j?: string | null) {
  if (!j) return null;
  switch (j) {
    case "F":   return { label: "Ferie",     cls: "bg-blue-100 text-blue-700" };
    case "M":   return { label: "Malattia",  cls: "bg-green-100 text-green-700" };
    case "ROL": return { label: "ROL",       cls: "bg-sky-100 text-sky-700" };
    case "L104":return { label: "L.104",     cls: "bg-orange-100 text-orange-700" };
    case "FES": return { label: "Festivo",   cls: "bg-red-100 text-red-700" };
    case "FP":  return { label: "Patronale", cls: "bg-rose-100 text-rose-700" };
    case "R":   return { label: "Riposo",    cls: "bg-gray-100 text-gray-700" };
    default:    return { label: j,           cls: "bg-slate-100 text-slate-700" };
  }
}

function ymd(yyyymm: string, day: number) {
  return `${yyyymm}-${String(day).padStart(2, "0")}`;
}

/* ===== Componente ===== */
export default function MonthlyPreview({ userId, yyyymm }: Props) {
  const [map, setMap] = useState<Record<string, DayDoc>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // selezione giorno
  const [openId, setOpenId] = useState<string | null>(null);

  const { lastDay, mondayIndex, totalCells } = useMemo(() => monthMeta(yyyymm), [yyyymm]);

  /* Realtime Firestore sul mese (include metadati per passare a "server" appena arriva) */
  useEffect(() => {
    setLoading(true);
    setErr(null);

    const start = `${yyyymm}-01`;
    const end = `${yyyymm}-31`;
    const col = collection(db, "timesheets", userId, "days");
    const q = query(
      col,
      where(documentId(), ">=", start),
      where(documentId(), "<=", end)
    );

    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        const out: Record<string, DayDoc> = {};
        snap.forEach((d) => (out[d.id] = d.data() as DayDoc));
        setMap(out);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || String(e));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId, yyyymm]);

  /* Revalidazione automatica: on mount, on focus, ogni 60s (server-first se disponibile) */
  useEffect(() => {
    let active = true;
    const col = collection(db, "timesheets", userId, "days");
    const start = `${yyyymm}-01`;
    const end = `${yyyymm}-31`;
    const qy = query(
      col,
      where(documentId(), ">=", start),
      where(documentId(), "<=", end)
    );

    async function revalidateFromServer() {
      try {
        // Prova ad usare getDocsFromServer se disponibile; fallback a getDocs
        // @ts-ignore
        const getDocsFromServer = (await import("firebase/firestore")).getDocsFromServer as
          | ((q: any) => Promise<any>)
          | undefined;

        const snap = getDocsFromServer ? await getDocsFromServer(qy) : await getDocs(qy);
        if (!active) return;

        const fresh: Record<string, DayDoc> = {};
        snap.forEach((d: any) => (fresh[d.id] = d.data() as DayDoc));
        setMap((prev) => {
          const prevKeys = Object.keys(prev);
          const newKeys = Object.keys(fresh);
          if (prevKeys.length !== newKeys.length) return fresh;
          for (const k of newKeys) {
            const a = prev[k];
            const b = fresh[k];
            if (!a || a.just !== b.just || a.ordinary !== b.ordinary || a.overtime !== b.overtime) {
              return fresh;
            }
          }
          return prev;
        });
      } catch {
        // se offline o errori, ci pensa onSnapshot quando torna la rete
      }
    }

    // on mount
    revalidateFromServer();

    // on focus
    const onVis = () => {
      if (document.visibilityState === "visible") revalidateFromServer();
    };
    document.addEventListener("visibilitychange", onVis);

    // ogni 60s
    const iv = setInterval(revalidateFromServer, 60000);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(iv);
    };
  }, [userId, yyyymm]);

  /* Totali mese live: ignorano i giorni con giustificativo */
  const { sumOrd, sumOt } = useMemo(() => {
    let o = 0;
    let s = 0;
    Object.values(map).forEach((v) => {
      if (v.just) return;
      if (typeof v.ordinary === "number") o += v.ordinary;
      if (typeof v.overtime === "number") s += v.overtime;
    });
    return { sumOrd: o, sumOt: s };
  }, [map]);

  const selected = openId ? map[openId] ?? {} : null;
  const selectedDayNum = openId ? Number(openId.slice(8, 10)) : null;

  /* Render */
  return (
    <div className="p-3 sm:p-4">
      {/* Barra totali sticky */}
      <div className="sticky top-0 z-10 mb-3">
        <div className="rounded-xl border bg-white/90 backdrop-blur px-3 py-2 flex items-center justify-between text-xs sm:text-sm">
          <div className="font-medium">Anteprima · {yyyymm}</div>
          <div className="font-medium">
            <span className="mr-3">Ord: <span className="font-mono">{fmt(sumOrd, true)}</span></span>
            <span>Straord: <span className="font-mono">{fmt(sumOt, true)}</span></span>
          </div>
        </div>
        {loading && <div className="mt-1 text-[11px] text-slate-500">Caricamento…</div>}
        {err && <div className="mt-1 text-[11px] text-red-600">{err}</div>}
      </div>

      {/* Intestazione giorni */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-[10px] sm:text-xs font-medium text-slate-600 mb-1 sm:mb-2">
        {DOW_LABELS.map((d) => (
          <div key={d} className="px-1.5 py-1 text-center truncate">{d}</div>
        ))}
      </div>

      {/* Griglia mese */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - mondayIndex + 1;
          if (dayNum < 1 || dayNum > lastDay) {
            return (
              <div
                key={`e-${idx}`}
                className="rounded-lg border border-slate-100 bg-slate-50/40 h-20 sm:h-24"
              />
            );
          }

          const id = ymd(yyyymm, dayNum);
          const row = map[id] || {};
          const jb = justBadge(row.just);
          const hasOrd = typeof row.ordinary === "number" && !row.just;
          const hasOt  = typeof row.overtime === "number" && !row.just;

          const cellTone =
            row.just
              ? "border-slate-200 bg-slate-50"
              : hasOrd || hasOt
              ? "border-emerald-100 bg-emerald-50/40"
              : "border-slate-100 bg-white";

          return (
            <button
              key={id}
              type="button"
              onClick={() => setOpenId(id)}
              className={`rounded-lg border h-20 sm:h-24 p-2 flex flex-col justify-between outline-none focus:ring-2 focus:ring-sky-300 ${cellTone}`}
              aria-label={`Apri dettagli ${id}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400"></span>
                <span className="text-xs sm:text-sm font-semibold">{String(dayNum).padStart(2, "0")}</span>
              </div>

              {row.just ? (
                <span className={`block text-center px-1 py-0.5 rounded-full text-[11px] ${jb?.cls} truncate`}>
                  {jb?.label}
                </span>
              ) : (
                <div className="text-center leading-tight">
                  {hasOrd && (
                    <div className="text-[11px] sm:text-xs font-medium text-slate-800">
                      Ord: {fmt(row.ordinary, true)}
                    </div>
                  )}
                  {hasOt && (
                    <div className="text-[11px] sm:text-xs font-medium text-slate-800">
                      Stra: {fmt(row.overtime, true)}
                    </div>
                  )}
                  {!hasOrd && !hasOt && (
                    <div className="text-[11px] text-slate-300 italic">—</div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Sheet: dettagli giorno */}
      {openId && (
        <div className="fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpenId(null)}
          />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl p-4 sm:p-6 border-t">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between">
              <h4 className="text-base sm:text-lg font-semibold">
                Dettagli — {openId}
              </h4>
              <button
                className="text-slate-600 hover:text-slate-900 text-sm px-2 py-1 rounded-md border"
                onClick={() => setOpenId(null)}
              >
                Chiudi
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg border bg-slate-50">
                <div className="text-[11px] text-slate-500">Tipo</div>
                {selected?.just ? (
                  <div className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs ${justBadge(selected?.just)?.cls}`}>
                    {justBadge(selected?.just)?.label}
                  </div>
                ) : (
                  <div className="mt-1 font-medium">Lavoro</div>
                )}
              </div>

              <div className="p-3 rounded-lg border bg-slate-50">
                <div className="text-[11px] text-slate-500">Aggiornato</div>
                <div className="mt-1">
                  {selected?.updatedAt
                    ? new Date(selected.updatedAt.toMillis()).toLocaleString()
                    : "—"}
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-slate-50">
                <div className="text-[11px] text-slate-500">Ordinarie</div>
                <div className="mt-1 font-mono">{selected?.just ? "—" : fmt(selected?.ordinary, true)}</div>
              </div>

              <div className="p-3 rounded-lg border bg-slate-50">
                <div className="text-[11px] text-slate-500">Straordinarie</div>
                <div className="mt-1 font-mono">{selected?.just ? "—" : fmt(selected?.overtime, true)}</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <small className="text-slate-500">
                Tocca una cella per aprire i dettagli del giorno.
              </small>
              <button
                className="px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50 text-sm"
                onClick={() => {
                  const ev = new CustomEvent("timesheet:pick-day", { detail: { id: openId, day: selectedDayNum } });
                  window.dispatchEvent(ev);
                  setOpenId(null);
                }}
              >
                Apri questo giorno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
