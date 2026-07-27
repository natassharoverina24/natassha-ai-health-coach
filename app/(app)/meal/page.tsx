"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection, useFirestoreDoc } from "@/hooks";
import { mealsRepository } from "@/lib/db/meals.repository";
import { mealPhotosRepository } from "@/lib/db/mealPhotos.repository";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { weightsRepository } from "@/lib/db/weights.repository";
import { settingsRepository } from "@/lib/db/settings.repository";
import { buildMealPhotoPath, deleteFile, uploadFile } from "@/lib/firebase/storage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  MealEntryForm,
  type MealFormValues,
  OfficeLunchQuickForm,
  type OfficeLunchFormValues,
  type WeightFormValues,
} from "@/components/forms";
import {
  DailyNutritionSummary,
  MealDetailModal,
  MealTypeSection,
  QuickLogFab,
  WaterTrackerCard,
} from "@/components/meal";
import { DEFAULT_GOALS } from "@/lib/utils/constants";
import { formatCalories, formatDateLabel, todayISODate } from "@/lib/utils/format";
import { sumMacros } from "@/lib/utils/nutritionEstimates";
import type { MealEntry, MealPhoto, MealType, UserSettings, WaterLogEntry } from "@/types/firestore";

const TYPE_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB

type AddModalState = { type: MealType } | null;

export default function MealPage() {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? null;
  const today = useMemo(() => todayISODate(), []);

  // "History" is not a separate screen — browsing to any date turns the
  // same timeline into a read/edit/delete history view for that day.
  // Today's date keeps the full live-tracking experience (water tracker,
  // quick log FAB, office lunch quick-add); any other date is history.
  const [viewDate, setViewDate] = useState(today);
  const isToday = viewDate === today;

  const [addModal, setAddModal] = useState<AddModalState>(null);
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);
  const [viewingMeal, setViewingMeal] = useState<MealEntry | null>(null);
  const [officeLunchModalOpen, setOfficeLunchModalOpen] = useState(false);
  const [addingWaterAmount, setAddingWaterAmount] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const { data: meals, loading: mealsLoading } = useFirestoreCollection<MealEntry>(
    uid ? (onData, onError) => mealsRepository.subscribeForUserByDate(uid, viewDate, onData, onError) : null,
    [uid, viewDate],
  );

  const { data: waterEntries, loading: waterLoading } = useFirestoreCollection<WaterLogEntry>(
    uid && isToday
      ? (onData, onError) => waterLogsRepository.subscribeForUserByDate(uid, today, onData, onError)
      : null,
    [uid, today, isToday],
  );

  const { data: settings } = useFirestoreDoc<UserSettings>(
    uid ? (onData, onError) => settingsRepository.subscribeForUser(uid, onData, onError) : null,
    [uid],
  );

  const { data: viewingMealPhotos } = useFirestoreCollection<MealPhoto>(
    viewingMeal ? (onData, onError) => mealPhotosRepository.subscribeForMeal(viewingMeal.id, onData, onError) : null,
    [viewingMeal?.id],
  );

  const goals = {
    calorieGoal: settings?.calorieGoal ?? DEFAULT_GOALS.calorieGoal,
    proteinGoalG: settings?.proteinGoalG ?? DEFAULT_GOALS.proteinGoalG,
    waterGoalMl: settings?.waterGoalMl ?? DEFAULT_GOALS.waterGoalMl,
  };

  // ---- Meal CRUD ----------------------------------------------------------

  const handleCreateMeal = async (values: MealFormValues) => {
    if (!uid) return;
    await mealsRepository.create({
      userId: uid,
      date: viewDate,
      type: values.type,
      name: values.name,
      quantity: values.quantity,
      isOfficeLunch: values.isOfficeLunch,
      macros: {
        calories: values.calories,
        proteinG: values.proteinG,
        carbsG: values.carbsG,
        fatG: values.fatG,
        fiberG: values.fiberG,
      },
      photoIds: [],
      score: null,
      note: values.note,
    });
    setAddModal(null);
  };

  const handleUpdateMeal = async (values: MealFormValues) => {
    if (!editingMeal) return;
    await mealsRepository.update(editingMeal.id, {
      type: values.type,
      name: values.name,
      quantity: values.quantity,
      isOfficeLunch: values.isOfficeLunch,
      macros: {
        calories: values.calories,
        proteinG: values.proteinG,
        carbsG: values.carbsG,
        fatG: values.fatG,
        fiberG: values.fiberG,
      },
      note: values.note,
    });
    setEditingMeal(null);
  };

  const handleDeleteMeal = async (id: string) => {
    await mealsRepository.remove(id);
  };

  const handleCreateOfficeLunch = async (values: OfficeLunchFormValues) => {
    if (!uid) return;
    await mealsRepository.create({
      userId: uid,
      date: viewDate,
      type: "lunch",
      name: values.name,
      quantity: null,
      isOfficeLunch: true,
      macros: {
        calories: values.calories,
        proteinG: values.proteinG,
        carbsG: values.carbsG,
        fatG: values.fatG,
        fiberG: values.fiberG,
      },
      photoIds: [],
      score: null,
      note: null,
    });
    setOfficeLunchModalOpen(false);
  };

  // ---- Meal photos ---------------------------------------------------------

  const handleUploadPhoto = async (file: File) => {
    if (!uid || !viewingMeal) return;
    if (!file.type.startsWith("image/")) {
      setPhotoUploadError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoUploadError("Image is too large (max 10MB).");
      return;
    }

    setUploadingPhoto(true);
    setPhotoUploadError(null);
    try {
      const path = buildMealPhotoPath(uid, file.name);
      const { storagePath, downloadURL } = await uploadFile(path, file);
      const photoId = await mealPhotosRepository.create({
        userId: uid,
        mealId: viewingMeal.id,
        storagePath,
        downloadURL,
        width: null,
        height: null,
        aiAnalyzed: false,
      });
      const updatedPhotoIds = [...viewingMeal.photoIds, photoId];
      await mealsRepository.update(viewingMeal.id, { photoIds: updatedPhotoIds });
      setViewingMeal({ ...viewingMeal, photoIds: updatedPhotoIds });
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photo: MealPhoto) => {
    if (!viewingMeal) return;
    setDeletingPhotoId(photo.id);
    try {
      await deleteFile(photo.storagePath);
      await mealPhotosRepository.remove(photo.id);
      const updatedPhotoIds = viewingMeal.photoIds.filter((id) => id !== photo.id);
      await mealsRepository.update(viewingMeal.id, { photoIds: updatedPhotoIds });
      setViewingMeal({ ...viewingMeal, photoIds: updatedPhotoIds });
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : "Failed to delete photo.");
    } finally {
      setDeletingPhotoId(null);
    }
  };

  // ---- Water ---------------------------------------------------------------

  const handleQuickAddWater = async (amountMl: number) => {
    if (!uid) return;
    setAddingWaterAmount(amountMl);
    try {
      await waterLogsRepository.create({
        userId: uid,
        date: today,
        amountMl,
        loggedAt: new Date().toISOString(),
      });
    } finally {
      setAddingWaterAmount(null);
    }
  };

  const handleDeleteWater = async (id: string) => {
    await waterLogsRepository.remove(id);
  };

  // ---- Quick Log FAB ---------------------------------------------------------

  const handleQuickLogWeight = async (values: WeightFormValues) => {
    if (!uid) return;
    await weightsRepository.create({
      userId: uid,
      date: values.date,
      weightKg: values.weightKg,
      bodyFatPercent: values.bodyFatPercent,
      muscleMassKg: null,
      note: values.note,
      source: "manual",
    });
  };

  // ---- Derived totals ---------------------------------------------------------

  const dayTotals = sumMacros(meals.map((m) => m.macros));
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: meals.filter((m) => m.type === type),
  }));

  const loading = mealsLoading || (isToday && waterLoading);

  return (
    <div className="flex flex-col gap-6 pb-20">
      <PageHeader
        title="Meal"
        description={isToday ? `Today · ${formatCalories(dayTotals.calories)}` : formatDateLabel(viewDate)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[160px]">
          <Input
            type="date"
            aria-label="Search meals by date"
            value={viewDate}
            max={today}
            leadingIcon={<CalendarDays size={16} />}
            onChange={(e) => setViewDate(e.target.value || today)}
          />
        </div>
        {!isToday && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setViewDate(today)}>
            Back to today
          </Button>
        )}
      </div>

      {loading ? (
        <MealPageSkeleton />
      ) : (
        <>
          <DailyNutritionSummary
            totals={dayTotals}
            calorieGoal={goals.calorieGoal}
            proteinGoalG={goals.proteinGoalG}
          />

          {isToday && (
            <WaterTrackerCard
              entries={waterEntries}
              goalMl={goals.waterGoalMl}
              onQuickAdd={handleQuickAddWater}
              onDelete={handleDeleteWater}
              addingAmountMl={addingWaterAmount}
            />
          )}

          <div className="flex flex-col gap-4">
            {grouped.map((group) => (
              <MealTypeSection
                key={group.type}
                type={group.type}
                label={TYPE_LABEL[group.type]}
                items={group.items}
                onAddFood={() => setAddModal({ type: group.type })}
                onAddOfficeLunch={
                  isToday && group.type === "lunch" && profile?.lunchProvidedByOffice
                    ? () => setOfficeLunchModalOpen(true)
                    : undefined
                }
                onView={(meal) => setViewingMeal(meal)}
                onEdit={(meal) => setEditingMeal(meal)}
                onDelete={handleDeleteMeal}
              />
            ))}
          </div>
        </>
      )}

      {isToday && (
        <QuickLogFab
          onLogFood={handleCreateMeal}
          onLogWater={handleQuickAddWater}
          onLogWeight={handleQuickLogWeight}
        />
      )}

      <Modal
        open={addModal !== null}
        onClose={() => setAddModal(null)}
        title={addModal ? `Add to ${TYPE_LABEL[addModal.type].toLowerCase()}` : "Add food"}
      >
        {addModal && (
          <MealEntryForm defaultType={addModal.type} submitLabel="Save food" onSubmit={handleCreateMeal} onCancel={() => setAddModal(null)} />
        )}
      </Modal>

      <Modal open={editingMeal !== null} onClose={() => setEditingMeal(null)} title="Edit food">
        {editingMeal && (
          <MealEntryForm
            initialValues={{
              type: editingMeal.type,
              name: editingMeal.name,
              quantity: editingMeal.quantity,
              isOfficeLunch: editingMeal.isOfficeLunch,
              calories: editingMeal.macros.calories,
              proteinG: editingMeal.macros.proteinG,
              carbsG: editingMeal.macros.carbsG,
              fatG: editingMeal.macros.fatG,
              fiberG: editingMeal.macros.fiberG,
              note: editingMeal.note,
            }}
            submitLabel="Save changes"
            onSubmit={handleUpdateMeal}
            onCancel={() => setEditingMeal(null)}
          />
        )}
      </Modal>

      <Modal open={officeLunchModalOpen} onClose={() => setOfficeLunchModalOpen(false)} title="Office lunch">
        <OfficeLunchQuickForm onSubmit={handleCreateOfficeLunch} onCancel={() => setOfficeLunchModalOpen(false)} />
      </Modal>

      <MealDetailModal
        meal={viewingMeal}
        photos={viewingMealPhotos}
        onClose={() => {
          setViewingMeal(null);
          setPhotoUploadError(null);
        }}
        onEdit={(meal) => {
          setViewingMeal(null);
          setEditingMeal(meal);
        }}
        onDelete={handleDeleteMeal}
        onUploadPhoto={handleUploadPhoto}
        onDeletePhoto={handleDeletePhoto}
        uploadingPhoto={uploadingPhoto}
        photoUploadError={photoUploadError}
        deletingPhotoId={deletingPhotoId}
      />
    </div>
  );
}

function MealPageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-72 w-full rounded-card" />
      <Skeleton className="h-48 w-full rounded-card" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-card" />
      ))}
    </div>
  );
}
