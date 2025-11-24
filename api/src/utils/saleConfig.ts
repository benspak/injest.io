/**
 * Cyber Week Sale configuration
 * Annual plan is always 80% off
 */

/**
 * Always returns 80% off annual plan price
 * $30/month * 12 = $360/year, 80% off = $72/year
 */
export function getAnnualPlanPriceCents(monthlyPriceCents: number): number {
  // 80% off: $30/month * 12 * 0.2 = $72/year
  return Math.round(monthlyPriceCents * 12 * 0.2);
}
