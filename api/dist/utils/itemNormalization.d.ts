import type { Item, AttachmentMetadata } from '../models/Item.js';
export declare function sanitizeOriginalFilename(originalname: string): string;
export declare function decodeOriginalFilename(originalname: string): string;
export declare function normalizeAttachments(attachments: any): AttachmentMetadata[] | null;
export declare function normalizeItem(item: Item): Item;
//# sourceMappingURL=itemNormalization.d.ts.map