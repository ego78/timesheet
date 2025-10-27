// src/lib/timesheet.ts
import { db } from "@/app/firebase";
import {
  doc,
  setDoc,
  getDocs,
  collection,
  where,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export type DayDoc = {
  ordinary?: number;        // ore ordinarie (decimali)
  overtime?: number;        // ore straordinarie (decimali)
  just?: string | null;     // giustificativo (es. "F", "ROL", "M", ...)
  updatedAt?: Timestamp;
  source?: "app";
};

/** Crea/aggiorna il documento del giorno `YYYY-MM-DD` per userId */
export async function upsertDay(userId: string, isoDate: string, patch: Partial<DayDoc>) {
  const ref = doc(db, "timesheets", userId, "days", isoDate);
  await setDoc(
    ref,
    {
      ...patch,
      source: "app",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Ritorna le giornate del mese `YYYY-MM` per userId (mappa { 'YYYY-MM-DD': DayDoc }) */
export async function getMonthDays(userId: string, yyyymm: string) {
  // Ricerchiamo per ID del documento (che è la data)
  const col = collection(db, "timesheets", userId, "days");
  const start = `${yyyymm}-01`;
  const end = `${yyyymm}-31`;
  const q = query(col, where("__name__", ">=", start), where("__name__", "<=", end));
  const snap = await getDocs(q);
  const out: Record<string, DayDoc> = {};
  snap.forEach((d) => (out[d.id] = d.data() as DayDoc));
  return out;
}
