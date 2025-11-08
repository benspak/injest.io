export function sanitizeOriginalFilename(originalname) {
    if (!originalname) {
        return originalname;
    }
    // Replace any path separators to prevent directory traversal or invalid file paths
    let sanitized = originalname.replace(/[\\/]+/g, '_');
    // Remove control characters that can cause issues on some filesystems or headers
    sanitized = sanitized.replace(/[\u0000-\u001F\u007F]/g, '');
    // Trim leading/trailing whitespace which is often added inadvertently
    sanitized = sanitized.trim();
    return sanitized;
}
export function decodeOriginalFilename(originalname) {
    if (!originalname) {
        return originalname;
    }
    try {
        const decoded = Buffer.from(originalname, 'binary').toString('utf8');
        if (decoded.includes('\uFFFD')) {
            return sanitizeOriginalFilename(originalname);
        }
        return sanitizeOriginalFilename(decoded.normalize('NFC'));
    }
    catch {
        return sanitizeOriginalFilename(originalname);
    }
}
export function normalizeAttachments(attachments) {
    if (!attachments) {
        return null;
    }
    let parsedAttachments = attachments;
    if (typeof attachments === 'string') {
        try {
            parsedAttachments = JSON.parse(attachments);
        }
        catch {
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
            const sanitizedOriginal = sanitizeOriginalFilename(decodedOriginal);
            return {
                ...attachment,
                originalname: sanitizedOriginal,
            };
        }
        return attachment;
    });
}
export function normalizeItem(item) {
    const normalizedAttachments = normalizeAttachments(item.attachments);
    if (normalizedAttachments === item.attachments) {
        return item;
    }
    return {
        ...item,
        attachments: normalizedAttachments ?? undefined,
    };
}
//# sourceMappingURL=itemNormalization.js.map