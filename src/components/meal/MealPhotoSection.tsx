"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Camera, ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  isSupportedMealImageType,
  type ConfirmedMealPhotoEstimate,
  type MealPhotoAnalysis,
} from "@/lib/ai/mealPhotoAnalysis";
import { cn } from "@/lib/utils/cn";

export interface MealPhotoSectionProps {
  onAnalyzeFile: (file: File) => Promise<MealPhotoAnalysis>;
  onConfirm: (estimate: ConfirmedMealPhotoEstimate) => Promise<void>;
  className?: string;
}

export function MealPhotoSection({
  onAnalyzeFile,
  onConfirm,
  className,
}: MealPhotoSectionProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MealPhotoAnalysis | null>(null);
  const [foodName, setFoodName] = useState("");
  const [portion, setPortion] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const releasePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  };

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isSupportedMealImageType(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }

    releasePreview();
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setAnalysis(null);
    setError(null);
    setAnalyzing(true);
    try {
      const result = await onAnalyzeFile(file);
      setAnalysis(result);
      setFoodName(result.items.map((item) => item.name).join(", "));
      setPortion(
        result.items.map((item) => item.estimatedPortion).join("; "),
      );
      setCalories(String(result.estimatedCalories));
      setProteinG(String(result.estimatedProteinG));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Meal-photo analysis could not be completed.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async (event: FormEvent) => {
    event.preventDefault();
    if (!analysis) return;
    const parsedCalories = Number(calories);
    const parsedProtein = Number(proteinG);
    if (
      !foodName.trim() ||
      !portion.trim() ||
      !Number.isFinite(parsedCalories) ||
      parsedCalories < 0 ||
      !Number.isFinite(parsedProtein) ||
      parsedProtein < 0
    ) {
      setError("Review every estimate before confirming.");
      return;
    }

    setConfirming(true);
    setError(null);
    try {
      await onConfirm({
        foodName: foodName.trim(),
        portion: portion.trim(),
        calories: parsedCalories,
        proteinG: parsedProtein,
        source: "photo-estimate",
        userConfirmed: true,
        estimatedAt: analysis.estimatedAt,
      });
      setAnalysis(null);
      releasePreview();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Confirmed estimates could not be saved.",
      );
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div>
        <p className="text-sm font-medium text-ink">Analyze a meal photo</p>
        <p className="text-xs text-ink-muted">
          The image is analyzed temporarily and is never saved. Estimates are
          uncertain and editable.
        </p>
        <p className="mt-1 text-xs font-medium text-amber-700">
          Upload food photos only. Do not include faces, documents, addresses,
          or other sensitive information.
        </p>
      </div>

      {previewUrl && (
        // A local object URL is intentionally used instead of a persisted URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Local meal preview"
          className="max-h-56 w-full rounded-control object-contain"
        />
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leadingIcon={<Camera size={14} />}
          isLoading={analyzing}
          onClick={() => cameraInputRef.current?.click()}
        >
          Take photo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          leadingIcon={<ImagePlus size={14} />}
          isLoading={analyzing}
          onClick={() => galleryInputRef.current?.click()}
        >
          Choose image
        </Button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Take a meal photo"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Choose a meal image"
      />

      {analysis && (
        <form onSubmit={handleConfirm} className="flex flex-col gap-3">
          <p role="status" className="text-xs font-medium text-amber-700">
            AI estimate: {analysis.confidence} confidence. Uncertain — review
            and correct every value before saving.
          </p>
          <Input
            name="photoEstimateFood"
            label="Food name"
            value={foodName}
            onChange={(event) => setFoodName(event.target.value)}
            required
          />
          <Input
            name="photoEstimatePortion"
            label="Estimated portion"
            value={portion}
            onChange={(event) => setPortion(event.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="photoEstimateCalories"
              type="number"
              min="0"
              step="any"
              label="Estimated calories"
              suffix="kcal"
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
              required
            />
            <Input
              name="photoEstimateProtein"
              type="number"
              min="0"
              step="any"
              label="Estimated protein"
              suffix="g"
              value={proteinG}
              onChange={(event) => setProteinG(event.target.value)}
              required
            />
          </div>
          {analysis.assumptions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-muted">Assumptions</p>
              <ul className="list-disc pl-5 text-xs text-ink-muted">
                {analysis.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}
          <Button type="submit" isLoading={confirming}>
            Confirm and update meal
          </Button>
        </form>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </section>
  );
}
