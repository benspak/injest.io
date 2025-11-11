import { contactNormalizers } from '../models/Contact.js';

export interface ContactCandidate {
  name?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
}

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const sanitizeValue = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isLikelyNameLine = (line: string): boolean => {
  if (!line) {
    return false;
  }
  if (line.length > 60 || line.length < 3) {
    return false;
  }

  const cleaned = line.replace(/[^A-Za-z\s'.-]/g, '');
  if (cleaned.trim().length === 0) {
    return false;
  }

  // Require at least one space to avoid single-word matches (e.g. job titles)
  if (!cleaned.includes(' ')) {
    return false;
  }

  // Avoid lines with typical job title keywords
  const lower = cleaned.toLowerCase();
  if (lower.includes('manager') || lower.includes('director') || lower.includes('engineer')) {
    return false;
  }

  return true;
};

const parseNameFromLine = (line: string): string | null => {
  if (!line) {
    return null;
  }
  let candidate = line;
  candidate = candidate.replace(EMAIL_REGEX, '').trim();

  // Remove wrapping characters like commas or angle brackets
  candidate = candidate.replace(/^[<>,:;]+/, '').replace(/[<>,:;]+$/, '').trim();

  if (isLikelyNameLine(candidate)) {
    return candidate;
  }

  return null;
};

const buildKey = (_name?: string | null, email?: string | null): string => {
  return contactNormalizers.email(sanitizeValue(email));
};

export class ContactExtractorService {
  extract(text: string): ContactCandidate[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const candidates = new Map<string, ContactCandidate>();
    let pendingName: string | null = null;

    lines.forEach((line, index) => {
      const emails = line.match(EMAIL_REGEX) ?? [];

      const inlineName = parseNameFromLine(line);

      if (emails.length === 0) {
        if (isLikelyNameLine(line)) {
          pendingName = line;
        } else {
          pendingName = null;
        }
        return;
      }

      const resolvedName = inlineName ?? pendingName;
      pendingName = null;

      const metadataBase: Record<string, unknown> = {
        source: 'ocr',
        line,
        lineIndex: index,
      };

      // Create/update candidates for emails
      emails.forEach((email) => {
        const key = buildKey(resolvedName, email);
        const existing = candidates.get(key) ?? {};
        const merged: ContactCandidate = {
          name: sanitizeValue(existing.name ?? resolvedName),
          email: sanitizeValue(existing.email ?? email),
          metadata: {
            ...(existing.metadata ?? {}),
            ...metadataBase,
          },
        };
        candidates.set(key, merged);
      });
    });

    return Array.from(candidates.values()).filter((candidate) => candidate.email);
  }
}

export const contactExtractor = new ContactExtractorService();
