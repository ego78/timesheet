export type WorkerProfile = {
  nome: string;
  cognome: string;
  sheetId: string;
  sheetGid?: number;
  sedeBase?: string;

  /** Orario contrattuale per giorno (ore con virgola, es: "8,00" | "4,50" | "0,00") */
  schedule?: {
    mon?: string; // Lunedì
    tue?: string; // Martedì
    wed?: string; // Mercoledì
    thu?: string; // Giovedì
    fri?: string; // Venerdì
    sat?: string; // Sabato
    sun?: string; // Domenica
  };

  /** Orari di lavoro predefiniti per giorno (facoltativi): HH:mm */
  scheduleTimes?: {
    mon?: { start?: string; end?: string };
    tue?: { start?: string; end?: string };
    wed?: { start?: string; end?: string };
    thu?: { start?: string; end?: string };
    fri?: { start?: string; end?: string };
    sat?: { start?: string; end?: string };
    sun?: { start?: string; end?: string };
  };
};

// ⚠️ email TUTTE in minuscolo come chiave
export const WORKERS: Record<string, WorkerProfile> = {
  "ego.giovanni@gmail.com": {
    nome: "Giovanni",
    cognome: "Piccione",
    sheetId: "11O3nkVwXCgKvn8yV6oW6il9N-ntPNGoCpmBD1sgNLgs",
    sheetGid: 1567696894, // usato per anteprima PDF
    sedeBase: "Corte D'Appello",
    // 8 ore lun-ven
    schedule: {
      mon: "8,00",
      tue: "8,00",
      wed: "8,00",
      thu: "8,00",
      fri: "8,00",
      sat: "0,00",
      sun: "0,00",
    },
    // Orari di riferimento 08:00–16:00
    scheduleTimes: {
      mon: { start: "08:00", end: "16:00" },
      tue: { start: "08:00", end: "16:00" },
      wed: { start: "08:00", end: "16:00" },
      thu: { start: "08:00", end: "16:00" },
      fri: { start: "08:00", end: "16:00" },
      sat: { start: "", end: "" }, // non lavora
      sun: { start: "", end: "" },
    },
  },

  "prefettorosy@gmail.com": {
    nome: "Rosa",
    cognome: "Prefetto",
    sheetId: "1u9djFI-cFSryei23JUxRct958ibm7LtSgeU11K-Gzlk",
    sheetGid: 1567696894,
    sedeBase: "Corte D'Appello",
    // 5 ore lun-sab
    schedule: {
      mon: "5,00",
      tue: "5,00",
      wed: "5,00",
      thu: "5,00",
      fri: "5,00",
      sat: "5,00",
      sun: "0,00",
    },
    // Orari di riferimento 13:00–18:00
    scheduleTimes: {
      mon: { start: "13:00", end: "18:00" },
      tue: { start: "13:00", end: "18:00" },
      wed: { start: "13:00", end: "18:00" },
      thu: { start: "13:00", end: "18:00" },
      fri: { start: "13:00", end: "18:00" },
      sat: { start: "13:00", end: "18:00" },
      sun: { start: "", end: "" },
    },
  },

  "giuseppebuccoliero87@yahoo.it": {
    nome: "Giuseppe",
    cognome: "Buccoliero",
    sheetId: "1e8XBFIc356oC3-GG1Mq-tQNNkmYp4R_zt6TQMZnV-E0",
    sheetGid: 1567696894,
    sedeBase: "Corte D'Appello",
    // 7 ore lun-ven, 3 ore sab
    schedule: {
      mon: "7,00",
      tue: "7,00",
      wed: "7,00",
      thu: "7,00",
      fri: "7,00",
      sat: "3,00",
      sun: "0,00",
    },
    // Orari tipici: 08:00–15:00 (7h), sab 09:00–12:00
    scheduleTimes: {
      mon: { start: "08:00", end: "15:00" },
      tue: { start: "08:00", end: "15:00" },
      wed: { start: "08:00", end: "15:00" },
      thu: { start: "08:00", end: "15:00" },
      fri: { start: "08:00", end: "15:00" },
      sat: { start: "09:00", end: "12:00" },
      sun: { start: "", end: "" },
    },
  },
};
