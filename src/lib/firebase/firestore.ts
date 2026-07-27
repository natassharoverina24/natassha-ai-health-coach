/**
 * Firestore Access Layer
 * ---------------------------------------------------------------------------
 * Generic, typed CRUD + query helpers shared by every repository in
 * src/lib/db. Nothing collection-specific lives here — that belongs in the
 * repositories, which compose these primitives.
 *
 * Timestamp convention: documents are written with Firestore `serverTimestamp()`
 * for createdAt/updatedAt, and read back as ISO-8601 strings so the rest of
 * the app (including tests) never has to import Firestore's Timestamp class.
 */
import {
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "./config";
import type { BaseDocument } from "@/types/firestore";

function toISO(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

/** Converts a raw Firestore snapshot into our BaseDocument-shaped type. */
export function fromSnapshot<T extends BaseDocument>(
  snap: QueryDocumentSnapshot<DocumentData>,
): T {
  const data = snap.data();
  return {
    ...(data as Omit<T, "id" | "createdAt" | "updatedAt">),
    id: snap.id,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  } as T;
}

export async function getDocument<T extends BaseDocument>(
  collectionName: string,
  id: string,
): Promise<T | null> {
  const ref = doc(db, collectionName, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return fromSnapshot<T>(snap as QueryDocumentSnapshot<DocumentData>);
}

export async function queryCollection<T extends BaseDocument>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromSnapshot<T>(d));
}

/** Live-subscribes to a query; returns the unsubscribe function. */
export function subscribeToCollection<T extends BaseDocument>(
  collectionName: string,
  constraints: QueryConstraint[],
  onData: (items: T[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, collectionName), ...constraints);
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => fromSnapshot<T>(d))),
    (error) => onError?.(error),
  );
}

export function subscribeToDocument<T extends BaseDocument>(
  collectionName: string,
  id: string,
  onData: (item: T | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const ref = doc(db, collectionName, id);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(fromSnapshot<T>(snap as QueryDocumentSnapshot<DocumentData>));
    },
    (error) => onError?.(error),
  );
}

export async function createDocument<
  T extends Record<string, unknown>,
>(collectionName: string, data: T, id?: string): Promise<string> {
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (id) {
    await setDoc(doc(db, collectionName, id), payload);
    return id;
  }

  const ref = await addDoc(collection(db, collectionName), payload);
  return ref.id;
}

export async function updateDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocument(
  collectionName: string,
  id: string,
): Promise<void> {
  await deleteDoc(doc(db, collectionName, id));
}

export { db };
export type { Firestore, QueryConstraint };
