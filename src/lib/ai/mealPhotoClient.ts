"use client";

import {
  MAX_MEAL_IMAGE_BYTES,
  isSupportedMealImageType,
  type MealPhotoAnalysis,
} from "./mealPhotoAnalysis";

const MAX_IMAGE_DIMENSION = 1_600;
const MULTIPART_OVERHEAD_RESERVE = 64 * 1024;
const MAX_COMPRESSED_FILE_BYTES =
  MAX_MEAL_IMAGE_BYTES - MULTIPART_OVERHEAD_RESERVE;

function canvasBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The image could not be compressed.")),
      "image/jpeg",
      quality,
    );
  });
}

export async function compressMealPhotoImage(file: File): Promise<File> {
  if (!isSupportedMealImageType(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The image could not be prepared.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= MAX_COMPRESSED_FILE_BYTES) {
        return new File([blob], "meal-photo.jpg", {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
    }
    throw new Error("The compressed image is too large (maximum 4 MiB).");
  } finally {
    bitmap.close();
  }
}

export async function requestMealPhotoAnalysis(
  file: File,
  options: {
    getIdToken?: () => Promise<string | null>;
    fetcher?: typeof fetch;
  } = {},
): Promise<MealPhotoAnalysis> {
  if (!isSupportedMealImageType(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_MEAL_IMAGE_BYTES) {
    throw new Error("The compressed image is too large (maximum 4 MiB).");
  }

  const getIdToken =
    options.getIdToken ??
    (async () => {
      const { getCurrentUserIdToken } = await import("@/lib/firebase/auth");
      return getCurrentUserIdToken();
    });
  const token = await getIdToken();
  if (!token) throw new Error("Sign in is required to analyze a meal photo.");

  const formData = new FormData();
  formData.set("image", file);
  const response = await (options.fetcher ?? fetch)("/api/ai/meal-photo", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : "Meal-photo analysis could not be completed.";
    throw new Error(message);
  }
  if (!body || typeof body !== "object" || !("analysis" in body)) {
    throw new Error("Meal-photo analysis returned an invalid response.");
  }
  return body.analysis as MealPhotoAnalysis;
}
