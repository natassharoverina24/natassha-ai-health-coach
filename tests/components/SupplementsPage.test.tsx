import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SupplementsPage from "@/app/(app)/supplements/page";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection } from "@/hooks";
import {
  supplementsRepository,
  supplementLogsRepository,
} from "@/lib/db/supplements.repository";
import type { SupplementDefinition } from "@/types/firestore";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks", () => ({ useFirestoreCollection: jest.fn() }));
jest.mock("@/lib/db/supplements.repository", () => ({
  supplementsRepository: {
    subscribeActiveForUser: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  supplementLogsRepository: {
    subscribeForUserByDate: jest.fn(),
    setTodayStatus: jest.fn(),
  },
}));

const savedSupplement: SupplementDefinition = {
  id: "supplement-1",
  userId: "user-1",
  name: "Supplement tersimpan",
  dosage: "teks user",
  frequency: "daily",
  timesOfDay: ["08:00"],
  active: true,
  provenance: "user_confirmed",
  userConfirmed: true,
  createdAt: "2026-08-02T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
};

let collectionCall = 0;

beforeEach(() => {
  collectionCall = 0;
  (useAuth as jest.Mock).mockReturnValue({ user: { uid: "user-1" } });
  (useFirestoreCollection as jest.Mock).mockImplementation(() => {
    const isDefinitions = collectionCall % 2 === 0;
    collectionCall += 1;
    return {
      data: isDefinitions ? [savedSupplement] : [],
      loading: false,
      error: null,
    };
  });
  (supplementsRepository.create as jest.Mock).mockReset().mockResolvedValue("new-id");
  (supplementsRepository.update as jest.Mock).mockReset().mockResolvedValue(undefined);
  (supplementLogsRepository.setTodayStatus as jest.Mock)
    .mockReset()
    .mockResolvedValue("log-id");
});

describe("Supplements page", () => {
  it("persists taken, skipped, and remind-later statuses", async () => {
    const user = userEvent.setup();
    render(<SupplementsPage />);

    await user.click(screen.getByRole("button", { name: "Sudah diminum" }));
    await waitFor(() =>
      expect(supplementLogsRepository.setTodayStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          supplementId: "supplement-1",
          status: "taken",
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Nanti ingetin" }));
    await user.click(screen.getByRole("button", { name: "Skip hari ini" }));
    expect(supplementLogsRepository.setTodayStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "remind-later" }),
    );
    expect(supplementLogsRepository.setTodayStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "skipped" }),
    );
  });

  it("creates only a user-confirmed supplement without inventing dosage", async () => {
    const user = userEvent.setup();
    render(<SupplementsPage />);

    await user.click(screen.getByRole("button", { name: "Tambah supplement" }));
    await user.type(screen.getByLabelText("Nama supplement"), "Rutinitas saya");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(supplementsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Rutinitas saya",
          dosage: null,
          provenance: "user_confirmed",
          userConfirmed: true,
          timesOfDay: ["08:00"],
        }),
      ),
    );
  });

  it("shows a general D3 timing suggestion and lets the user override it", async () => {
    const user = userEvent.setup();
    render(<SupplementsPage />);

    await user.click(screen.getByRole("button", { name: "Tambah supplement" }));
    await user.type(screen.getByLabelText("Nama supplement"), "Vitamin D3");

    expect(screen.getByText("Saran waktu umum")).toBeInTheDocument();
    expect(screen.getByText("Bisa kamu ubah")).toBeInTheDocument();
    expect(screen.getByText(/lebih nyaman diminum bareng makan/i)).toBeInTheDocument();
    expect(screen.getByText(/bukan instruksi medis/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Waktu pengingat (opsional)")).toHaveValue("08:00");

    await user.clear(screen.getByLabelText("Waktu pengingat (opsional)"));
    await user.type(screen.getByLabelText("Waktu pengingat (opsional)"), "14:35");
    expect(screen.getByText("Aku pakai jadwal yang kamu pilih ya.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() =>
      expect(supplementsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ timesOfDay: ["14:35"] }),
      ),
    );
  });

  it("shows and preserves the saved time while editing", async () => {
    const user = userEvent.setup();
    render(<SupplementsPage />);

    await user.click(screen.getByRole("button", { name: "Ubah jadwal" }));
    expect(screen.getByLabelText("Waktu pengingat (opsional)")).toHaveValue("08:00");
    expect(screen.getByText("Aku pakai jadwal yang kamu pilih ya.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    await waitFor(() =>
      expect(supplementsRepository.update).toHaveBeenCalledWith(
        "supplement-1",
        expect.objectContaining({ timesOfDay: ["08:00"] }),
      ),
    );
  });

  it("shows a friendly error without raw Firestore details", () => {
    (useFirestoreCollection as jest.Mock).mockImplementation(() => ({
      data: [],
      loading: false,
      error: "FirebaseError permission-denied https://console.firebase.google.com/secret",
    }));
    render(<SupplementsPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(/belum bisa dimuat/i);
    expect(screen.queryByText(/permission-denied|console\.firebase|secret/i)).not.toBeInTheDocument();
  });
});
