/**
 * Canonical onboarding option registry — the ONE place the Step 2 business-
 * information form and its server-side validation both read from, so the
 * UI can never offer a value the server rejects. Before this file existed,
 * app/onboarding/page.tsx rendered Industry as a free-text field with no
 * connection at all to app/api/businesses/route.ts's hard-coded enum, which
 * had no "Technology"/"Software" option — a real business owner typing
 * "Software" (a completely ordinary answer) hit a generic 400 with no way
 * to know why. Business size and goals were already implicitly consistent
 * (the client hard-codes one valid value for each rather than exposing a
 * picker), but are centralized here too so a future picker can't drift
 * either.
 *
 * These are literal, human-readable category names (not slugs) — matching
 * this codebase's existing convention (businesses.industry/businessSize are
 * free-text columns storing exactly these strings, not an enum id).
 */

export const ONBOARDING_INDUSTRIES = [
  "Technology",
  "Retail",
  "Professional Services",
  "Healthcare",
  "Real Estate",
  "Education",
  "Travel",
  "Other",
] as const;

export type OnboardingIndustry = (typeof ONBOARDING_INDUSTRIES)[number];

export function isOnboardingIndustry(value: string): value is OnboardingIndustry {
  return (ONBOARDING_INDUSTRIES as readonly string[]).includes(value);
}

export const ONBOARDING_BUSINESS_SIZES = [
  "Solo",
  "2-10 employees",
  "11-50 employees",
  "51-200 employees",
  "200+",
] as const;

export type OnboardingBusinessSize = (typeof ONBOARDING_BUSINESS_SIZES)[number];

export function isOnboardingBusinessSize(value: string): value is OnboardingBusinessSize {
  return (ONBOARDING_BUSINESS_SIZES as readonly string[]).includes(value);
}

export const ONBOARDING_GOALS = [
  "Get more customers",
  "Automate customer support",
  "Improve sales follow-up",
  "Reduce repetitive work",
  "Manage operations",
  "Improve response time",
] as const;

export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number];

export function isOnboardingGoal(value: string): value is OnboardingGoal {
  return (ONBOARDING_GOALS as readonly string[]).includes(value);
}
