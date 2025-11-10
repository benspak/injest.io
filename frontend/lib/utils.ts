import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const normalizeOrigin = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return undefined
  }

  const sanitized = trimmed.replace(/\/+$/, "")

  if (/^https?:\/\//i.test(sanitized)) {
    return sanitized
  }

  return `https://${sanitized}`
}

export function buildItemShareUrl(itemId: string): string {
  if (!itemId) {
    throw new Error("Item ID is required to build share URL")
  }

  const runtimeOrigin =
    typeof window !== "undefined" ? window.location.origin : undefined

  const envOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)

  const baseUrl = runtimeOrigin || envOrigin || ""

  return baseUrl ? `${baseUrl}/items/${itemId}` : `/items/${itemId}`
}
