import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Path to the Next.js app, used to load next.config.js and .env files.
  dir: "./",
});

const customJestConfig: Config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  collectCoverageFrom: [
    "src/lib/utils/**/*.{ts,tsx}",
    "src/lib/db/**/*.{ts,tsx}",
    "src/components/ui/**/*.{ts,tsx}",
  ],
};

// next/jest returns an async function that merges in Next's own config.
export default createJestConfig(customJestConfig);
