"use client";

import React, { useEffect, useMemo, useState } from "react";
import { listPresenceMonth } from "@/lib/masterPresence";

type PresenceDay = {
  email: string;
  date: string;             // "YYYY-MM-DD"
  just?: string | null;     // F, ROL, M, FES, FP, L104, R
  ordinary?: number | null; // ore in decimale (es: 7.5)
  overtime?: number | null; // ore in decimale (es: 1.5)
  start?: string | null;    // "HH:MM" (NON visualizziamo)
  end?: string | null;      // "HH:MM" (NON visualizziamo)
  note?: string | null;
};

function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDecimiIT(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "";
  // decimi → 1 cifra decimale
  return n.toFixed(1).replace(".", ",");
}

export default function MonthlyPreview({
  email,
  yyyymm,
  refreshToken,      // facoltativo: quando cambia, ricarica i dati
}: {
  email: string;
  yyyymm: string; // "YYYY-MM"
  refreshToken?: number | string;
}) {
  const [rows, setRows] = useState<PresenceDay[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // dettaglio giorno (modal)
  const [openDetail, setOpenDetail] = useState<PresenceDay | null>(null);

  // parse yyyymm
  const [Y, M] = yyyymm.split("-").map(Number);
  const y = Y;
  const m0 = M - 1; // 0-based
  const totalDays = daysInMonth(y, m0);

  // Lunedì come primo giorno
  const firstDow = new Date(y, m0, 1).getDay(); // 0=Dom ... 6=Sab
  const startOffset = (firstDow + 6) % 7; // Lun=0

  // carica dati mese
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        const data = await listPresenceMonth(email, yyyymm);
        if (!mounted) return;
        setRows(data);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // ricarica se cambia email, mese o refreshToken
  }, [email, yyyymm, refreshToken]);

  // indicizzazione per data
  const map = useMemo(() => {
    const m = new Map<string, PresenceDay>();
    rows.forEach((r) => m.set(r.date, r));
    return m;
  }, [rows]);

  // costruisci celle
  const cells: Array<{ label: string; date?: string; data?: PresenceDay }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ label: "" });
  for (let d = 1; d <= totalDays; d++) {
    const date = `${y}-${pad2(M)}-${pad2(d)}`;
    const data = map.get(date);
    cells.push({ label: String(d), date, data });
  }
  while (cells.length % 7 !== 0) cells.push({ label: "" });

  // totali mese (decimi)
  const { totOrd, totOt } = useMemo(() => {
    let o = 0;
    let t = 0;
    for (const r of rows) {
      if (typeof r.ordinary === "number") o += r.ordinary;
      if (typeof r.overtime === "number") t += r.overtime;
    }
    return { totOrd: o, totOt: t };
  }, [rows]);

  const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="p-3">
      {/* stato caricamento / errore */}
      {loading && <p className="text-sm text-slate-500 p-2">Caricamento…</p>}
      {err && <p className="text-sm text-red-600 p-2">Errore anteprima: {err}</p>}

      {/* header con mese + totali */}
      {/* header con mese + totali */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
  <h3 className="text-base font-semibold text-slate-800">
    {new Date(y, m0, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
  </h3>

  <div className="flex flex-wrap items-center gap-2 text-sm">
    <span className="text-slate-700 font-medium mr-1">Totali:</span>
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
      <strong>Ordinario:</strong> {formatDecimiIT(totOrd)}
    </span>
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
      <strong>Straordinario:</strong> {formatDecimiIT(totOt)}
    </span>
  </div>
</div>

      {/* intestazione giorni settimana */}
      <div className="grid grid-cols-7 gap-2 text-xs font-medium text-slate-600 mb-2">
        {weekDays.map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>

      {/* griglia mese */}
      <div className="grid grid-cols-7 gap-2">
        {cells.map((c, i) => {
          const hasContent = Boolean(c.label);
          const just = c.data?.just ? String(c.data.just) : "";

          // badge sinistra: ordinario o giustificativo
          const leftBadge = (() => {
            if (!c.data) return null;
            if (just) {
              // giustificativo a sinistra
              const cls =
                just === "F"
                  ? "bg-blue-100 text-blue-700"
                  : just === "M"
                  ? "bg-green-100 text-green-700"
                  : just === "ROL"
                  ? "bg-sky-100 text-sky-700"
                  : just === "L104"
                  ? "bg-orange-100 text-orange-700"
                  : just === "FES"
                  ? "bg-red-100 text-red-700"
                  : just === "FP"
                  ? "bg-rose-100 text-rose-700"
                  : just === "R"
                  ? "bg-gray-100 text-gray-700"
                  : "bg-slate-100 text-slate-700";
              return { txt: just, cls };
            }
            if (typeof c.data.ordinary === "number" && c.data.ordinary > 0) {
              return { txt: `Or ${formatDecimiIT(c.data.ordinary)}`, cls: "bg-emerald-100 text-emerald-700" };
            }
            return null;
          })();

          // badge destra: straordinario
          const rightBadge =
            c.data && typeof c.data.overtime === "number" && c.data.overtime > 0
              ? { txt: `St ${formatDecimiIT(c.data.overtime)}`, cls: "bg-amber-100 text-amber-700" }
              : null;

          return (
            <button
              key={i}
              type="button"
              disabled={!hasContent}
              onClick={() => {
                if (c.data) setOpenDetail(c.data);
              }}
              className={`min-h-[82px] rounded-lg border p-2 text-left ${
                hasContent ? "bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400" : "bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-slate-700">{c.label}</span>

                {/* destra: straordinario */}
                {rightBadge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${rightBadge.cls}`}>{rightBadge.txt}</span>
                )}
              </div>

              {/* sinistra (riga sotto il numero): ordinario/giustificativo */}
              <div className="mt-1">
                {leftBadge && (
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${leftBadge.cls}`}>
                    {leftBadge.txt}
                  </span>
                )}
              </div>

              {/* NOTE (troncate) */}
              {c.data?.note && (
                <div className="mt-1 text-[10px] text-slate-500 truncate" title={c.data.note || ""}>
                  {c.data.note}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* MODAL DETTAGLIO GIORNO */}
      {openDetail && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="bg-white w-[92%] max-w-md rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">
                Dettaglio — {new Date(openDetail.date + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
              </h4>
              <button
                onClick={() => setOpenDetail(null)}
                className="px-2 py-1 rounded-md border hover:bg-slate-50"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Giustificativo</span>
                <span className="font-medium">{openDetail.just || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Ordinario (h)</span>
                <span className="font-medium">{formatDecimiIT(openDetail.ordinary ?? null) || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Straordinario (h)</span>
                <span className="font-medium">{formatDecimiIT(openDetail.overtime ?? null) || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Inizio</span>
                <span className="font-medium">{openDetail.start || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Fine</span>
                <span className="font-medium">{openDetail.end || "—"}</span>
              </div>

              <div>
                <span className="text-slate-600">Note</span>
                <p className="mt-1 whitespace-pre-wrap">{openDetail.note || "—"}</p>
              </div>
            </div>

            <div className="mt-5 text-xs text-slate-500">
              I valori sono salvati nel **master** e riflettono l’ultima sincronizzazione.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
