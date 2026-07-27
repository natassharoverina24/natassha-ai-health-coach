/**
 * App-wide constants. Anything that might one day come from remote config
 * or Firestore `settings` still gets a sane default here.
 */

export const APP_NAME = "Natassha AI Health Coach";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/weight", label: "Weight", icon: "Scale" },
  { href: "/meal", label: "Meal", icon: "UtensilsCrossed" },
  { href: "/progress", label: "Progress", icon: "TrendingUp" },
  { href: "/shopping", label: "Shopping", icon: "ShoppingCart" },
  { href: "/supplements", label: "Supplements", icon: "Pill" },
  { href: "/reports", label: "Reports", icon: "FileBarChart" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;

/** Bottom tab bar on mobile shows a curated subset; the rest live in "More". */
export const MOBILE_PRIMARY_NAV = ["dashboard", "weight", "meal", "progress"] as const;

export const DEFAULT_GOALS = {
  waterGoalMl: 2000,
  stepsGoal: 8000,
  proteinGoalG: 110,
  calorieGoal: 1400,
  workoutGoalMinPerDay: 30,
  sleepGoalHours: 7,
} as const;

export const DEFAULT_USER_PROFILE = {
  displayName: "Natassha",
  heightCm: 155,
  startWeightKg: 71,
  goalWeightKg: 53,
  country: "Indonesia",
  leaveHomeTime: "06:30",
  arriveHomeTime: "19:00",
  lunchProvidedByOffice: true,
  unitSystem: "metric" as const,
};
