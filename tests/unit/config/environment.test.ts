import {
  ProductionEnvironmentError,
  REQUIRED_FIREBASE_ENVIRONMENT_VARIABLES,
  resolveFirebaseEnvironment,
  validateFirebaseEnvironment,
  type FirebaseEnvironmentValues,
} from "@/lib/config/environment";

const configuredValues: FirebaseEnvironmentValues = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "project.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "project-id",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:abcdef",
};

describe("Firebase environment validation", () => {
  it("accepts a complete production configuration", () => {
    const result = validateFirebaseEnvironment(configuredValues, "production");

    expect(result.status).toBe("configured");
    if (result.status === "configured") {
      expect(result.config.projectId).toBe("project-id");
      expect(result.missingVariables).toEqual([]);
    }
  });

  it("does not require Firebase Storage configuration", () => {
    const result = validateFirebaseEnvironment(
      { ...configuredValues, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: undefined },
      "production",
    );
    expect(result.status).toBe("configured");
  });

  it("reports every missing production variable deterministically", () => {
    const result = validateFirebaseEnvironment({}, "production");

    expect(result).toEqual({
      status: "invalid-production-environment",
      missingVariables: REQUIRED_FIREBASE_ENVIRONMENT_VARIABLES,
    });
  });

  it("treats whitespace-only values as missing", () => {
    const result = validateFirebaseEnvironment(
      { ...configuredValues, NEXT_PUBLIC_FIREBASE_APP_ID: "  " },
      "production",
    );

    expect(result).toEqual({
      status: "invalid-production-environment",
      missingVariables: ["NEXT_PUBLIC_FIREBASE_APP_ID"],
    });
  });

  it.each(["development", "test", undefined])(
    "uses placeholders outside production without real credentials (%s)",
    (nodeEnvironment) => {
      const result = validateFirebaseEnvironment({}, nodeEnvironment);
      expect(result.status).toBe("development-placeholder");
      if (result.status === "development-placeholder") {
        expect(result.config.projectId).toBe("demo-project");
      }
    },
  );

  it("throws a field-specific production error without exposing supplied values", () => {
    const secretLikeValue = "do-not-print-this-value";

    expect(() =>
      resolveFirebaseEnvironment(
        {
          ...configuredValues,
          NEXT_PUBLIC_FIREBASE_API_KEY: secretLikeValue,
          NEXT_PUBLIC_FIREBASE_APP_ID: "",
        },
        "production",
      ),
    ).toThrow(ProductionEnvironmentError);

    try {
      resolveFirebaseEnvironment(
        {
          ...configuredValues,
          NEXT_PUBLIC_FIREBASE_API_KEY: secretLikeValue,
          NEXT_PUBLIC_FIREBASE_APP_ID: "",
        },
        "production",
      );
    } catch (error) {
      expect(String(error)).toContain("NEXT_PUBLIC_FIREBASE_APP_ID");
      expect(String(error)).not.toContain(secretLikeValue);
    }
  });
});
