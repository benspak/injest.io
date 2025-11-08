import type { Item, AttachmentMetadata } from '../models/Item.js';

export function decodeOriginalFilename(originalname: string): string {
  if (!originalname) {
    return originalname;
  }

  try {
    const decoded = Buffer.from(originalname, 'binary').toString('utf8');
    if (decoded.includes('\uFFFD')) {
      return originalname;
    }
    return decoded.normalize('NFC');
  } catch {
    return originalname;
  }
}

export function normalizeAttachments(attachments: any): AttachmentMetadata[] | null {
  if (!attachments) {
    return null;
  }

  let parsedAttachments = attachments;
  if (typeof attachments === 'string') {
    try {
      parsedAttachments = JSON.parse(attachments);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsedAttachments)) {
    return parsedAttachments;
  }

  return parsedAttachments.map((attachment) => {
    if (!attachment || typeof attachment !== 'object') {
      return attachment;
    }

    if (typeof attachment.originalname === 'string') {
      const decodedOriginal = decodeOriginalFilename(attachment.originalname);
      return {
        ...attachment,
        originalname: decodedOriginal,
      };
    }

    return attachment as AttachmentMetadata;
  });
}

export function normalizeItem(item: Item): Item {
  const normalizedAttachments = normalizeAttachments(item.attachments);

  if (normalizedAttachments === item.attachments) {
    return item;
  }

  return {
    ...item,
    attachments: normalizedAttachments ?? undefined,
  };
}
