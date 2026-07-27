/**
 * users repository
 * One profile document per authenticated user, keyed by Firebase Auth uid
 * (document id === uid, so lookups never require a query).
 */
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/config";
import { createRepository } from "./baseRepository";
import { COLLECTIONS, type UserProfile } from "@/types/firestore";

const base = createRepository<UserProfile>(COLLECTIONS.users);

export const usersRepository = {
  ...base,

  /** Profile doc id is the Firebase Auth uid — fetch directly, no query needed. */
  getByUid(uid: string) {
    return base.get(uid);
  },

  subscribeByUid(
    uid: string,
    onData: (profile: UserProfile | null) => void,
    onError?: (error: Error) => void,
  ) {
    return base.subscribeOne(uid, onData, onError);
  },

  /** Creates the profile doc on first sign-in if it doesn't exist yet. */
  async ensureProfile(
    uid: string,
    defaults: Omit<UserProfile, "id" | "createdAt" | "updatedAt" | "uid">,
  ): Promise<UserProfile> {
    const ref = doc(db, COLLECTIONS.users, uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return { id: uid, ...(snap.data() as Omit<UserProfile, "id">) };
    }

    const payload = {
      ...defaults,
      uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    return { id: uid, ...defaults, uid, createdAt: "", updatedAt: "" };
  },

  updateProfile(uid: string, data: Partial<UserProfile>) {
    return base.update(uid, data);
  },
};
