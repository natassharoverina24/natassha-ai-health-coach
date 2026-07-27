/**
 * Base Repository
 * ---------------------------------------------------------------------------
 * This is the Clean Architecture seam between "business logic / UI" and
 * "Firestore". Every collection gets a repository built from this factory,
 * so swapping Firestore for another database later only means rewriting
 * src/lib/firebase + this file — nothing above this layer needs to change.
 */
import type { QueryConstraint } from "firebase/firestore";

import {
  createDocument,
  deleteDocument,
  getDocument,
  queryCollection,
  subscribeToCollection,
  subscribeToDocument,
  updateDocument,
} from "@/lib/firebase/firestore";
import type { BaseDocument } from "@/types/firestore";

export interface Repository<T extends BaseDocument> {
  collectionName: string;
  get(id: string): Promise<T | null>;
  list(constraints?: QueryConstraint[]): Promise<T[]>;
  create(data: Omit<T, "id" | "createdAt" | "updatedAt">, id?: string): Promise<string>;
  update(id: string, data: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(
    constraints: QueryConstraint[],
    onData: (items: T[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  subscribeOne(
    id: string,
    onData: (item: T | null) => void,
    onError?: (error: Error) => void,
  ): () => void;
}

export function createRepository<T extends BaseDocument>(
  collectionName: string,
): Repository<T> {
  return {
    collectionName,

    get(id) {
      return getDocument<T>(collectionName, id);
    },

    list(constraints = []) {
      return queryCollection<T>(collectionName, constraints);
    },

    create(data, id) {
      return createDocument(collectionName, data, id);
    },

    update(id, data) {
      return updateDocument(collectionName, id, data);
    },

    remove(id) {
      return deleteDocument(collectionName, id);
    },

    subscribe(constraints, onData, onError) {
      return subscribeToCollection<T>(collectionName, constraints, onData, onError);
    },

    subscribeOne(id, onData, onError) {
      return subscribeToDocument<T>(collectionName, id, onData, onError);
    },
  };
}
