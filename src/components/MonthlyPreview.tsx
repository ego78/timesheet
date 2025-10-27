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
} from "firebase/firestore";

type DayDoc = {
  ordinary?: number;        // ore ordinarie (decimali)
  overtime?: number;        // ore straordinarie (decimali)
  just?: string | null;     // giustificativo (es. "F", "ROL", "M", ...)
  updatedAt?: Timestamp;
  source?: "app";
};

type Props = {
  userId: string;   // stesso usato in scrittura
  yyyymm: string;   // "YYYY-MM"
};

/* ---- utils ---- */
function fmt(n?: number | null, showZero = false) {
  if (typeof n !== "number" || Number.isNaN(n)) return showZero ? "0,00" : "";
  if (!showZero && Math.abs(n) < 1e-9) return "";
  return n.toFixed(2).replace(".", ",");
}

const DOW_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function monthMeta(yyyymm: string) {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(5, 7)); // 1..12
  const first = new Date(y, m - 1, 1, 12, 0, 0, 0);
  const lastDay = new Date(y, m, 0, 12, 0, 0, 0).getDate();
  // JS: 0=Dom,1=Lun,... → 0=Lun,...6=Dom
  const mondayIndex = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayIndex + lastDay) / 7) * 7;
  return { lastDay, mondayIndex, totalCells };
}

function justBadge(j?: string | null) {
  if (!j) return null;
  switch (j) {
    case "F":   return { label: "Ferie",        cls: "bg-blue-100 text-blue-700" };
    case "M":   return { label: "Malattia",     cls: "bg-green-100 text-green-700" };
    case "ROL": return { label: "ROL",          cls: "bg-sky-100 text-sky-700" };
    case "L104":return { label: "L.104",        cls: "bg-orange-100 text-orange-700" };
    case "FES": return { label: "Festivo",      cls: "bg-red-100 text-red-700" };
    case "FP":  return { label: "Patronale",    cls: "bg-rose-100 text-rose-700" };
    case "R":   return { label: "Riposo",       cls: "bg-gray-100 text-gray-700" };
    default:    return { label: j,              cls: "bg-slate-100 text-slate-700" };
  }
}

export default function MonthlyPreview({ userId, yyyymm }: Props) {
  const [map, setMap] = useState<Record<string, DayDoc>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const { lastDay, mondayIndex, totalCells } = useMemo(() => monthMeta(yyyymm), [yyyymm]);

  // Realtime sul mese
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

  // ✅ Totali: ignorano i giorni con giustificativo
  const { sumOrd, sumOt } = useMemo(() => {
    let o = 0;
    let s = 0;
    Object.values(map).forEach((v) => {
      if (v.just) return; // se c'è giustificativo, non sommare
      if (typeof v.ordinary === "number") o += v.ordinary;
      if (typeof v.overtime === "number") s += v.overtime;
    });
    return { sumOrd: o, sumOt: s };
  }, [map]);

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

      {/* intestazione giorni */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-[10px] sm:text-xs font-medium text-slate-600 mb-1 sm:mb-2">
        {DOW_LABELS.map((d) => (
          <div key={d} className="px-1.5 py-1 text-center truncate">{d}</div>
        ))}
      </div>

      {/* griglia mese */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - mondayIndex + 1;
          if (dayNum < 1 || dayNum > lastDay) {
            return (
              <div
                key={`e-${idx}`}
                className="rounded-lg border border-slate-100 bg-slate-50/40 h-16 sm:h-24"
              />
            );
          }

          const id = `${yyyymm}-${String(dayNum).padStart(2, "0")}`;
          const row = map[id] || {};
          const jb = justBadge(row.just);
          const hasOrd = typeof row.ordinary === "number" && row.just == null;
          const hasOt  = typeof row.overtime === "number" && row.just == null;

          const cellTone =
            row.just
              ? "border-slate-200 bg-slate-50"
              : hasOrd || hasOt
              ? "border-emerald-100 bg-emerald-50/40"
              : "border-slate-100 bg-white";

          return (
            <div
              key={id}
              className={`rounded-lg border h-16 sm:h-24 p-1.5 sm:p-2 flex flex-col ${cellTone}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs text-slate-400"> </span>
                <span className="text-xs sm:text-sm font-semibold">{String(dayNum).padStart(2, "0")}</span>
              </div>

              <div className="mt-1 flex-1 flex flex-col gap-1 overflow-hidden">
                {row.just ? (
                  <span className={`w-fit max-w-full px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs ${jb?.cls} truncate`}>
                    {jb?.label}
                  </span>
                ) : (
                  <>
                    {hasOrd && (
                      <div className="w-fit max-w-full px-1.5 py-0.5 rounded-full bg-white/70 border text-[10px] sm:text-xs font-medium truncate">
                        O {fmt(row.ordinary)}
                      </div>
                    )}
                    {hasOt && (
                      <div className="w-fit max-w-full px-1.5 py-0.5 rounded-full bg-white/70 border text-[10px] sm:text-xs font-medium truncate">
                        S {fmt(row.overtime)}
                      </div>
                    )}
                    {!hasOrd && !hasOt && (
                      <div className="text-[10px] text-slate-300 italic">—</div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
