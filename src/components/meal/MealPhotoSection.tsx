"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import Image from "next/image";
import { Camera, ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils/cn";
import type { MealPhoto } from "@/types/firestore";

export interface MealPhotoSectionProps {
  photos: MealPhoto[];
  onUploadFile: (file: File) => Promise<void>;
  onDeletePhoto: (photo: MealPhoto) => Promise<void>;
  uploading: boolean;
  uploadError: string | null;
  deletingPhotoId: string | null;
  className?: string;
}

/**
 * Two capture entry points on one <input type="file" accept="image/*">
 * each: `capture="environment"` opens the device camera directly on
 * mobile browsers that support it, while the plain input opens the
 * system's normal file/gallery picker. On desktop `capture` is simply
 * ignored, so both buttons degrade to the same file-upload dialog —
 * satisfying "Camera & Gallery (mobile) / File upload (web)" from a
 * single, standard HTML control rather than a native-only API.
 */
export function MealPhotoSection({
  photos,
  onUploadFile,
  onDeletePhoto,
  uploading,
  uploadError,
  deletingPhotoId,
  className,
}: MealPhotoSectionProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    await onUploadFile(file);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative h-24 w-24 overflow-hidden rounded-control">
              <Image src={photo.downloadURL} alt="Meal photo" fill sizes="96px" className="object-cover" />
              <button
                type="button"
                onClick={() => void onDeletePhoto(photo)}
                disabled={deletingPhotoId === photo.id}
                aria-label="Delete photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-danger disabled:opacity-50"
              >
                {deletingPhotoId === photo.id ? <Spinner size={12} /> : <X size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leadingIcon={<Camera size={14} />}
          isLoading={uploading}
          onClick={() => cameraInputRef.current?.click()}
        >
          Take photo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          leadingIcon={<ImagePlus size={14} />}
          isLoading={uploading}
          onClick={() => galleryInputRef.current?.click()}
        >
          Choose from gallery
        </Button>
      </div>

      {uploadError && <p className="text-xs text-danger">{uploadError}</p>}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Take a photo"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Choose a photo from gallery"
      />
    </div>
  );
}
