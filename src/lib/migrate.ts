// src/lib/migrate.ts
import { db } from "@/app/firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";

/**
 * Copia tutti i documenti giorno dal vecchio path per email
 * verso il nuovo path per uid. Da eseguire UNA SOLA VOLTA
 * dopo il login dell'utente.
 */
export async function migrateEmailDaysToUid(emailLower: string, uid: string) {
  if (!emailLower || !uid || emailLower === uid) return;

  const legacyCol = collection(db, "timesheets", emailLower, "days");
  const snap = await getDocs(legacyCol);
  if (snap.empty) return;

  const writes: Promise<any>[] = [];
  snap.forEach((d) => {
    const data = d.data();
    const dest = doc(db, "timesheets", uid, "days", d.id);
    // merge:true per non perdere eventuali scritture già presenti
    writes.push(setDoc(dest, data, { merge: true }));
  });
  await Promise.all(writes);
}
