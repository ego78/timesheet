// src/lib/masterPresence.ts
const GAS_ENDPOINT =
  process.env.NEXT_PUBLIC_GAS_ENDPOINT ||
  "https://script.google.com/macros/s/AKfycbxOcvGN3V64Rjk3aun2sLdEHKrjFqPTPMLcZM8X00x1N6Hy5DLWTtiLHk6QwA-uAXPOxA/exec";

const SECRET = "CAMBIA-MI";

export type PresenceDay = {
  email: string;
  date: string;             // "YYYY-MM-DD"
  just?: string | null;     // F, ROL, M, FES, FP, L104, R oppure null
  ordinary?: number | null; // es. 7.5
  overtime?: number | null; // es. 1.5
  start?: string | null;    // "HH:MM"
  end?: string | null;      // "HH:MM"
  note?: string | null;
};

async function postJson<T>(payload: any): Promise<T> {
  const res = await fetch(GAS_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ secret: SECRET, ...payload }), // no headers → simple request
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json().catch(() => ({} as any));
  if (!json?.ok) throw new Error(json?.error || "Errore server");
  return json as T;
}

/** Salva tutto in un colpo: scritture foglio personale + presenze master + sync piano. */
export async function saveAll(payload: {
  email: string;
  sheetId: string;
  writes: { range: string; value: any }[];
  presence: PresenceDay;
  plan?: { op: "UPSERT" | "DELETE"; items: Array<{ date: string; tipo: "FERIE"|"ROL"; nome?: string; cognome?: string; note?: string; }> };
}) {
  return postJson<{ ok: true; result: any }>({ action: "saveAll", ...payload });
}

/** Elenca presenze per anteprima griglia (YYYY-MM). */
export async function listPresenceMonth(email: string, yyyymm: string) {
  const data = await postJson<{ ok: true; data: PresenceDay[] }>({
    action: "listPresenceMonth",
    email,
    yyyymm,
  });
  return data.data || [];
}
