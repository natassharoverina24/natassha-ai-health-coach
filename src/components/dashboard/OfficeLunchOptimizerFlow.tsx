"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  generateOfficeLunchPlan,
  type OfficeLunchAction,
  type OfficeLunchPlan,
  type OfficeLunchRecommendation,
  type PlannerUserContext,
} from "@/lib/planner";
import { OFFICE_LUNCH_ITEMS } from "@/lib/utils/nutritionEstimates";

const INDONESIAN_LABELS: Readonly<Record<string, string>> = {
  rice: "Nasi",
  chicken: "Ayam",
  fish: "Ikan",
  egg: "Telur",
  tempe: "Tempe",
  tofu: "Tahu",
  vegetables: "Sayur",
  soup: "Sup",
  fruit: "Buah",
  dessert: "Dessert",
  sweet_drink: "Minuman manis",
};

const ACTION_LABELS: Readonly<Record<OfficeLunchAction, string>> = {
  Eat: "Makan",
  Reduce: "Kurangi",
  Add: "Tambah",
  Skip: "Lewati",
};

interface OfficeLunchOptimizerFlowProps {
  decision: CoachDecision;
  context: PlannerUserContext;
}

function instructionFor(recommendation: OfficeLunchRecommendation): string {
  const label = INDONESIAN_LABELS[recommendation.itemKey] ?? recommendation.label;
  switch (recommendation.action) {
    case "Eat":
      return `${label} boleh dimakan sesuai sajian katalog.`;
    case "Reduce":
      return `Ambil ${label} lebih sedikit dari sajian katalog.`;
    case "Add":
      return `Prioritaskan ${label} sesuai sajian katalog yang tersedia.`;
    case "Skip":
      return `${label} boleh dilewati untuk arahan ini.`;
  }
}

function reasonFor(recommendation: OfficeLunchRecommendation): string {
  switch (recommendation.action) {
    case "Eat":
      return "Sajian ini masih sesuai dengan sisa target kalori harian.";
    case "Reduce":
      return "Sajian katalog melewati sisa target kalori, jadi cukup kurangi porsinya tanpa menghukum diri.";
    case "Add":
      return recommendation.reason.includes("PMS")
        ? "Insight PMS yang sudah dipertahankan coach mendukung tambahan protein yang praktis."
        : "Insight protein-first yang sudah dipertahankan coach memprioritaskan dukungan protein.";
    case "Skip":
      return "Aksi ini hanya boleh muncul dari konflik target atau guardrail non-Thyroid yang sudah dipertahankan.";
  }
}

export function OfficeLunchOptimizerFlow({
  decision,
  context,
}: OfficeLunchOptimizerFlowProps) {
  const [open, setOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [customItem, setCustomItem] = useState("");
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [remainingCalories, setRemainingCalories] = useState("");
  const [remainingProtein, setRemainingProtein] = useState("");
  const [result, setResult] = useState<OfficeLunchPlan | null>(null);
  const [partial, setPartial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());

  const selectedItems = useMemo(
    () => OFFICE_LUNCH_ITEMS.filter((item) => selectedKeys.includes(item.key)),
    [selectedKeys],
  );

  const resetResult = () => {
    setResult(null);
    setPartial(false);
    setError(null);
    setCheckedKeys(new Set());
  };

  const toggleItem = (key: string) => {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
    resetResult();
  };

  const addCustomItem = () => {
    const normalized = customItem.trim();
    if (!normalized) return;
    if (!customItems.some((item) => item.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
      setCustomItems((current) => [...current, normalized]);
    }
    setCustomItem("");
    resetResult();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setPartial(false);
    setCheckedKeys(new Set());

    if (selectedKeys.length === 0 && customItems.length === 0) {
      setError("Pilih minimal satu menu kantor dulu ya.");
      return;
    }

    if (!context.lunchProvidedByOffice) {
      setError("Office lunch belum aktif di profil. Aktifkan dulu supaya coach tidak menebak konteks makan siangmu.");
      return;
    }

    const caloriesText = remainingCalories.trim();
    const proteinText = remainingProtein.trim();
    if (!caloriesText || !proteinText) {
      setPartial(true);
      return;
    }

    const calories = Number(caloriesText);
    const proteinG = Number(proteinText);
    if (
      !Number.isFinite(calories) ||
      !Number.isFinite(proteinG) ||
      calories < 0 ||
      proteinG < 0
    ) {
      setError("Sisa kalori dan protein harus berupa angka nol atau lebih.");
      return;
    }

    setResult(
      generateOfficeLunchPlan(
        decision,
        context,
        { calories, proteinG },
        { itemKeys: selectedKeys },
      ),
    );
  };

  const toggleChecked = (itemKey: string) => {
    setCheckedKeys((current) => {
      const next = new Set(current);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  };

  if (!open) {
    return (
      <div className="rounded-control bg-petal-soft p-4">
        <p className="text-sm text-ink">
          Masukkan menu kantor hari ini, lalu coach bantu pilih yang dimakan, dikurangi, ditambah, atau dilewati.
        </p>
        <Button
          type="button"
          className="mt-3 w-full sm:w-auto"
          onClick={() => setOpen(true)}
          trailingIcon={<ChevronDown size={16} />}
        >
          Buka Office Lunch Optimizer
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-control bg-petal-soft p-4">
        <p className="text-sm font-semibold text-ink">
          Menu kantor hari ini bisa kita akalin kok 💗
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Pilih hanya yang benar-benar tersedia. Angka nutrisi tetap memakai katalog yang sudah disetujui.
        </p>
      </div>

      <form aria-label="Office lunch optimizer" className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Apa saja menunya?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OFFICE_LUNCH_ITEMS.map((item) => {
              const selected = selectedKeys.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleItem(item.key)}
                  className={
                    selected
                      ? "flex min-h-11 items-center justify-center gap-1.5 rounded-control bg-rose px-3 py-2 text-sm font-semibold text-white"
                      : "flex min-h-11 items-center justify-center rounded-control border border-rose/20 bg-bg-elevated px-3 py-2 text-sm font-medium text-ink"
                  }
                >
                  {selected && <Check size={14} />}
                  {INDONESIAN_LABELS[item.key] ?? item.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-control border border-rose/15 p-3">
          <label htmlFor="office-lunch-custom-item" className="text-sm font-medium text-ink">
            Menu lain
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id="office-lunch-custom-item"
              name="officeLunchCustomItem"
              value={customItem}
              onChange={(event) => setCustomItem(event.target.value)}
              placeholder="Contoh: soto ayam"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              leadingIcon={<Plus size={15} />}
              onClick={addCustomItem}
              disabled={!customItem.trim()}
            >
              Tambah menu
            </Button>
          </div>
          {customItems.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Menu custom">
              {customItems.map((item) => (
                <li key={item} className="flex items-center gap-1 rounded-pill bg-petal-soft px-3 py-1.5 text-xs text-ink">
                  {item}
                  <button
                    type="button"
                    aria-label={`Hapus ${item}`}
                    onClick={() => {
                      setCustomItems((current) => current.filter((value) => value !== item));
                      resetResult();
                    }}
                    className="rounded-full p-0.5 text-ink-muted"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            Menu custom tidak diberi angka atau arahan otomatis sampai nutrisinya dikonfirmasi.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Sisa target hari ini</p>
          <p className="mt-1 text-xs text-ink-muted">
            Kalau belum tahu, boleh dikosongkan. Coach akan menampilkan status sebagian tanpa menebak angka.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              id="office-lunch-remaining-calories"
              name="officeLunchRemainingCalories"
              label="Sisa kalori"
              type="number"
              min="0"
              value={remainingCalories}
              onChange={(event) => {
                setRemainingCalories(event.target.value);
                resetResult();
              }}
              suffix="kcal"
            />
            <Input
              id="office-lunch-remaining-protein"
              name="officeLunchRemainingProtein"
              label="Sisa protein"
              type="number"
              min="0"
              value={remainingProtein}
              onChange={(event) => {
                setRemainingProtein(event.target.value);
                resetResult();
              }}
              suffix="g"
            />
          </div>
        </div>

        <Button type="submit" className="w-full">
          Buat arahan makan siang
        </Button>
      </form>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {partial && (
          <div role="status" className="rounded-control bg-petal-soft px-3 py-3 text-sm text-ink">
            Menu sudah terbaca, tapi sisa target belum lengkap. Isi sisa kalori dan protein untuk mendapatkan
            arahan Eat, Reduce, Add, atau Skip tanpa angka buatan.
          </div>
        )}

        {result && !result.applicable && (
          <p role="status" className="rounded-control bg-petal-soft px-3 py-2 text-sm text-ink">
            {result.reason}
          </p>
        )}

        {result?.applicable && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                Oke, dari menu kantor hari ini, ini arahan paling pas buat targetmu.
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Sistem mendukung aksi Eat, Reduce, Add, dan Skip; hanya aksi yang valid untuk menu hari ini yang ditampilkan.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2" aria-label="Arahan Office Lunch">
              {result.recommendations.map((recommendation) => {
                const checked = checkedKeys.has(recommendation.itemKey);
                return (
                  <li
                    key={recommendation.itemKey}
                    className="rounded-control border border-rose/15 bg-bg-elevated p-3"
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChecked(recommendation.itemKey)}
                        aria-label={`Tandai ${INDONESIAN_LABELS[recommendation.itemKey] ?? recommendation.label} selesai`}
                        className="mt-1 h-5 w-5 rounded accent-[var(--color-rose)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className={checked ? "text-sm font-semibold text-ink-muted line-through" : "text-sm font-semibold text-ink"}>
                            {INDONESIAN_LABELS[recommendation.itemKey] ?? recommendation.label}
                          </span>
                          <span className="rounded-pill bg-petal-soft px-2.5 py-1 text-xs font-semibold text-rose-strong">
                            {ACTION_LABELS[recommendation.action]} ({recommendation.action})
                          </span>
                        </span>
                        <span className="mt-2 block text-sm text-ink">{instructionFor(recommendation)}</span>
                        <span className="mt-1 block text-xs text-ink-muted">{reasonFor(recommendation)}</span>
                        <span className="mt-1 block text-xs text-ink-faint">
                          Acuan sajian: {recommendation.serving}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {selectedItems.length === 0 && (
              <p role="status" className="rounded-control bg-petal-soft px-3 py-2 text-sm text-ink">
                Belum ada item katalog yang bisa dinilai. Menu custom tetap belum dimasukkan ke arahan.
              </p>
            )}
            {customItems.length > 0 && (
              <p role="status" className="text-xs text-ink-muted">
                Menu custom belum ikut dinilai: {customItems.join(", ")}.
              </p>
            )}
            <p className="text-xs text-ink-muted">
              Checklist tersimpan sementara selama halaman ini terbuka; persistence bisa ditambahkan sebagai follow-up terpisah.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
