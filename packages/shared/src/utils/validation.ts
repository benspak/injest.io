export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidCronExpression(cron: string): boolean {
  // Basic validation for cron: minute hour day month dayOfWeek
  const parts = cron.trim().split(/\s+/);
  return parts.length >= 5 && parts.length <= 6;
}

export function sanitizeString(input: string, maxLength = 255): string {
  return input.trim().slice(0, maxLength);
}
