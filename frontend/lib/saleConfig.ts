/**
 * Cyber Week Sale configuration
 * Sale expires: December 2, 2025 at 12:00 AM MST
 */

// December 2, 2025 at 12:00 AM MST
// MST is UTC-7, so 12:00 AM MST = 7:00 AM UTC
export const SALE_END_DATE = new Date('2025-12-02T07:00:00Z');

/**
 * Check if the sale banner should be displayed
 * Always shows the banner (until manually disabled)
 */
export function shouldShowSaleBanner(): boolean {
  return true;
}

/**
 * Always returns 80% off annual plan price
 * $30/month * 12 = $360/year, 80% off = $72/year
 */
export function getAnnualPlanPriceCents(monthlyPriceCents: number): number {
  // 80% off: $30/month * 12 * 0.2 = $72/year
  return Math.round(monthlyPriceCents * 12 * 0.2);
}

/**
 * Always returns 80% discount
 */
export function getAnnualPlanDiscount(): number {
  return 80;
}
