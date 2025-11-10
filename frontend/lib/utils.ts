import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function buildItemShareUrl(itemId: string): string {
  if (!itemId) {
    throw new Error("Item ID is required to build share URL")
  }

  const runtimeOrigin =
    typeof window !== "undefined" ? window.location.origin : undefined

  const envOrigin = process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")
    : undefined

  const baseUrl = runtimeOrigin || envOrigin || ""

  return baseUrl ? `${baseUrl}/items/${itemId}` : `/items/${itemId}`
}
