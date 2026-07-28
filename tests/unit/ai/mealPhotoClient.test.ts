import {
  compressMealPhotoImage,
  requestMealPhotoAnalysis,
} from "@/lib/ai/mealPhotoClient";

describe("meal-photo client", () => {
  const originalCreateImageBitmap = global.createImageBitmap;

  afterEach(() => {
    global.createImageBitmap = originalCreateImageBitmap;
    jest.restoreAllMocks();
  });

  it("compresses and resizes supported images before upload", async () => {
    const close = jest.fn();
    global.createImageBitmap = jest.fn().mockResolvedValue({
      width: 3_200,
      height: 2_400,
      close,
    });
    const drawImage = jest.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => ({ drawImage })),
      toBlob: jest.fn((callback: BlobCallback) =>
        callback(new Blob(["compressed"], { type: "image/jpeg" })),
      ),
    } as unknown as HTMLCanvasElement;
    jest.spyOn(document, "createElement").mockReturnValue(canvas);

    const result = await compressMealPhotoImage(
      new File(["original"], "meal.png", { type: "image/png" }),
    );

    expect(result.type).toBe("image/jpeg");
    expect(canvas.width).toBe(1_600);
    expect(canvas.height).toBe(1_200);
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it("requires authentication and never calls Firebase Storage", async () => {
    const fetcher = jest.fn();
    await expect(
      requestMealPhotoAnalysis(
        new File(["image"], "meal.jpg", { type: "image/jpeg" }),
        { getIdToken: async () => null, fetcher },
      ),
    ).rejects.toThrow("Sign in is required");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects unsupported and oversized compressed files", async () => {
    await expect(
      requestMealPhotoAnalysis(
        new File(["gif"], "meal.gif", { type: "image/gif" }),
        { getIdToken: async () => "token", fetcher: jest.fn() },
      ),
    ).rejects.toThrow("JPEG, PNG, or WebP");

    const oversized = new File(
      [new Uint8Array(4 * 1024 * 1024 + 1)],
      "meal.jpg",
      { type: "image/jpeg" },
    );
    await expect(
      requestMealPhotoAnalysis(oversized, {
        getIdToken: async () => "token",
        fetcher: jest.fn(),
      }),
    ).rejects.toThrow("maximum 4 MiB");
  });
});
