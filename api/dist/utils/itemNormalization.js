export function decodeOriginalFilename(originalname) {
    if (!originalname) {
        return originalname;
    }
    try {
        const decoded = Buffer.from(originalname, 'binary').toString('utf8');
        if (decoded.includes('\uFFFD')) {
            return originalname;
        }
        return decoded.normalize('NFC');
    }
    catch {
        return originalname;
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
            return {
                ...attachment,
                originalname: decodedOriginal,
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