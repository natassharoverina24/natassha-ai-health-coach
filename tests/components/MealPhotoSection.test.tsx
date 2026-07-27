import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MealPhotoSection } from "@/components/meal/MealPhotoSection";
import type { MealPhoto } from "@/types/firestore";

function makePhoto(overrides: Partial<MealPhoto> = {}): MealPhoto {
  return {
    id: "photo-1",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    userId: "user-1",
    mealId: "meal-1",
    storagePath: "users/user-1/meal_photos/1.jpg",
    downloadURL: "https://firebasestorage.googleapis.com/meal.jpg",
    width: null,
    height: null,
    aiAnalyzed: false,
    ...overrides,
  };
}

describe("MealPhotoSection", () => {
  it("renders both capture entry points", () => {
    render(
      <MealPhotoSection
        photos={[]}
        onUploadFile={jest.fn()}
        onDeletePhoto={jest.fn()}
        uploading={false}
        uploadError={null}
        deletingPhotoId={null}
      />,
    );
    expect(screen.getByRole("button", { name: /take photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose from gallery/i })).toBeInTheDocument();
  });

  it("renders a thumbnail for each existing photo", () => {
    render(
      <MealPhotoSection
        photos={[makePhoto(), makePhoto({ id: "photo-2" })]}
        onUploadFile={jest.fn()}
        onDeletePhoto={jest.fn()}
        uploading={false}
        uploadError={null}
        deletingPhotoId={null}
      />,
    );
    expect(screen.getAllByAltText("Meal photo")).toHaveLength(2);
  });

  it("calls onDeletePhoto with the photo when its delete button is clicked", async () => {
    const onDeletePhoto = jest.fn().mockResolvedValue(undefined);
    const photo = makePhoto();
    render(
      <MealPhotoSection
        photos={[photo]}
        onUploadFile={jest.fn()}
        onDeletePhoto={onDeletePhoto}
        uploading={false}
        uploadError={null}
        deletingPhotoId={null}
      />,
    );
    await userEvent.click(screen.getByLabelText("Delete photo"));
    expect(onDeletePhoto).toHaveBeenCalledWith(photo);
  });

  it("shows the upload error message when present", () => {
    render(
      <MealPhotoSection
        photos={[]}
        onUploadFile={jest.fn()}
        onDeletePhoto={jest.fn()}
        uploading={false}
        uploadError="Image is too large (max 10MB)."
        deletingPhotoId={null}
      />,
    );
    expect(screen.getByText("Image is too large (max 10MB).")).toBeInTheDocument();
  });

  it("passes the selected file to onUploadFile", async () => {
    const onUploadFile = jest.fn().mockResolvedValue(undefined);
    render(
      <MealPhotoSection
        photos={[]}
        onUploadFile={onUploadFile}
        onDeletePhoto={jest.fn()}
        uploading={false}
        uploadError={null}
        deletingPhotoId={null}
      />,
    );
    const file = new File(["fake-bytes"], "lunch.jpg", { type: "image/jpeg" });
    const galleryInput = screen.getByLabelText("Choose a photo from gallery");
    await userEvent.upload(galleryInput, file);
    expect(onUploadFile).toHaveBeenCalledWith(file);
  });
});
