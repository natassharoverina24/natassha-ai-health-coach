/**
 * Firebase Storage Layer
 * ---------------------------------------------------------------------------
 * Upload/delete helpers for user-generated files (meal photos, exported
 * reports). Paths are namespaced by uid so Storage Security Rules can lock
 * each user to their own folder — see storage.rules.
 */
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from "firebase/storage";

import { storage } from "./config";

export interface UploadResult {
  storagePath: string;
  downloadURL: string;
}

export type UploadProgressCallback = (progressPercent: number) => void;

export function buildMealPhotoPath(uid: string, fileName: string): string {
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return `users/${uid}/meal_photos/${timestamp}_${safeName}`;
}

export function buildReportPath(uid: string, fileName: string): string {
  return `users/${uid}/reports/${fileName}`;
}

export function uploadFile(
  path: string,
  file: File | Blob,
  onProgress?: UploadProgressCallback,
): Promise<UploadResult> {
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot: UploadTaskSnapshot) => {
        if (onProgress) {
          const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(Math.round(pct));
        }
      },
      (error) => reject(error),
      async () => {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        resolve({ storagePath: path, downloadURL });
      },
    );
  });
}

export async function deleteFile(path: string): Promise<void> {
  await deleteObject(ref(storage, path));
}
