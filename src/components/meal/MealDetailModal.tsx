"use client";

import { Clock, Pencil, Trash2 } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MealPhotoSection } from "./MealPhotoSection";
import { formatCalories, formatGrams, formatTimeLabel } from "@/lib/utils/format";
import type { MealEntry, MealPhoto } from "@/types/firestore";

export interface MealDetailModalProps {
  meal: MealEntry | null;
  photos: MealPhoto[];
  onClose: () => void;
  onEdit: (meal: MealEntry) => void;
  onDelete: (id: string) => void;
  onUploadPhoto: (file: File) => Promise<void>;
  onDeletePhoto: (photo: MealPhoto) => Promise<void>;
  uploadingPhoto: boolean;
  photoUploadError: string | null;
  deletingPhotoId: string | null;
}

interface MacroStatProps {
  label: string;
  value: string;
}

function MacroStat({ label, value }: MacroStatProps) {
  return (
    <div className="rounded-control bg-ink/5 px-3 py-2.5 text-center">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

/** Read-only detail view for a single logged food, with photo management and quick access to edit/delete. */
export function MealDetailModal({
  meal,
  photos,
  onClose,
  onEdit,
  onDelete,
  onUploadPhoto,
  onDeletePhoto,
  uploadingPhoto,
  photoUploadError,
  deletingPhotoId,
}: MealDetailModalProps) {
  return (
    <Modal open={meal !== null} onClose={onClose} title={meal?.name ?? "Meal detail"}>
      {meal && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            {meal.quantity && <span className="text-sm text-ink-muted">{meal.quantity}</span>}
            {meal.isOfficeLunch && <Badge tone="rose">Office lunch</Badge>}
            <span className="ml-auto flex items-center gap-1 text-xs text-ink-muted">
              <Clock size={12} />
              {formatTimeLabel(meal.createdAt)}
            </span>
          </div>

          <MealPhotoSection
            photos={photos}
            onUploadFile={onUploadPhoto}
            onDeletePhoto={onDeletePhoto}
            uploading={uploadingPhoto}
            uploadError={photoUploadError}
            deletingPhotoId={deletingPhotoId}
          />

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <MacroStat label="Calories" value={formatCalories(meal.macros.calories)} />
            <MacroStat label="Protein" value={formatGrams(meal.macros.proteinG)} />
            <MacroStat label="Carbs" value={formatGrams(meal.macros.carbsG)} />
            <MacroStat label="Fat" value={formatGrams(meal.macros.fatG)} />
            <MacroStat label="Fiber" value={formatGrams(meal.macros.fiberG ?? 0)} />
          </div>

          {meal.note && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Notes</p>
              <p className="mt-1 text-sm text-ink">{meal.note}</p>
            </div>
          )}

          <div className="flex gap-3 border-t border-ink/8 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              leadingIcon={<Pencil size={14} />}
              onClick={() => onEdit(meal)}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              leadingIcon={<Trash2 size={14} />}
              onClick={() => {
                onDelete(meal.id);
                onClose();
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
