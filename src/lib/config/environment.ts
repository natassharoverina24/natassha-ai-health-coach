/**
 * Pure validation for Firebase's public web configuration.
 *
 * This module never reads process.env directly, so tests can exercise every
 * state without real credentials and server-only values cannot enter client
 * bundles through this layer.
 */

export const REQUIRED_FIREBASE_ENVIRONMENT_VARIABLES = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export type RequiredFirebaseEnvironmentVariable =
  (typeof REQUIRED_FIREBASE_ENVIRONMENT_VARIABLES)[number];

export interface FirebaseEnvironmentValues {
  NEXT_PUBLIC_FIREBASE_API_KEY?: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
  NEXT_PUBLIC_FIREBASE_APP_ID?: string;
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
}

export interface ValidatedFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export type FirebaseEnvironmentResult =
  | {
      status: "configured";
      config: ValidatedFirebaseConfig;
      missingVariables: [];
    }
  | {
      status: "development-placeholder";
      config: ValidatedFirebaseConfig;
      missingVariables: RequiredFirebaseEnvironmentVariable[];
    }
  | {
      status: "invalid-production-environment";
      missingVariables: RequiredFirebaseEnvironmentVariable[];
    };

const DEVELOPMENT_PLACEHOLDER_CONFIG: ValidatedFirebaseConfig = {
  apiKey: "demo-api-key-not-configured",
  authDomain: "demo-project.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
};

function present(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateFirebaseEnvironment(
  values: FirebaseEnvironmentValues,
  nodeEnvironment: string | undefined,
): FirebaseEnvironmentResult {
  const missingVariables = REQUIRED_FIREBASE_ENVIRONMENT_VARIABLES.filter(
    (variable) => !present(values[variable]),
  );

  if (missingVariables.length > 0) {
    if (nodeEnvironment === "production") {
      return {
        status: "invalid-production-environment",
        missingVariables,
      };
    }
    return {
      status: "development-placeholder",
      config: { ...DEVELOPMENT_PLACEHOLDER_CONFIG },
      missingVariables,
    };
  }

  return {
    status: "configured",
    config: {
      apiKey: values.NEXT_PUBLIC_FIREBASE_API_KEY!.trim(),
      authDomain: values.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!.trim(),
      projectId: values.NEXT_PUBLIC_FIREBASE_PROJECT_ID!.trim(),
      storageBucket: values.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!.trim(),
      messagingSenderId:
        values.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!.trim(),
      appId: values.NEXT_PUBLIC_FIREBASE_APP_ID!.trim(),
      measurementId: present(values.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID)
        ? values.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID.trim()
        : undefined,
    },
    missingVariables: [],
  };
}

export class ProductionEnvironmentError extends Error {
  readonly missingVariables: readonly RequiredFirebaseEnvironmentVariable[];

  constructor(missingVariables: readonly RequiredFirebaseEnvironmentVariable[]) {
    super(
      `Production Firebase configuration is incomplete. Missing: ${missingVariables.join(
        ", ",
      )}.`,
    );
    this.name = "ProductionEnvironmentError";
    this.missingVariables = [...missingVariables];
  }
}

export function resolveFirebaseEnvironment(
  values: FirebaseEnvironmentValues,
  nodeEnvironment: string | undefined,
): Exclude<
  FirebaseEnvironmentResult,
  { status: "invalid-production-environment" }
> {
  const result = validateFirebaseEnvironment(values, nodeEnvironment);
  if (result.status === "invalid-production-environment") {
    throw new ProductionEnvironmentError(result.missingVariables);
  }
  return result;
}
