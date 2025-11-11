const LINE_BREAK_REGEX = /\r\n|\n|\r/;
const decodeQuotedPrintable = (value) => {
    // Basic quoted-printable decoding for UTF-8 strings
    return value
        .replace(/=([0-9A-F]{2})/gi, (_, hex) => {
        try {
            return String.fromCharCode(Number.parseInt(hex, 16));
        }
        catch {
            return _;
        }
    })
        .replace(/=\r?\n/g, '');
};
const unfoldLines = (lines) => {
    const unfolded = [];
    for (const line of lines) {
        if (line.startsWith(' ') || line.startsWith('\t')) {
            const lastIndex = unfolded.length - 1;
            if (lastIndex >= 0) {
                unfolded[lastIndex] += line.slice(1);
            }
        }
        else {
            unfolded.push(line);
        }
    }
    return unfolded;
};
const parsePropertyValue = (rawValue, params) => {
    const trimmed = rawValue.trim();
    const encodingParam = params.find((param) => param.toUpperCase().startsWith('ENCODING='));
    const charsetParam = params.find((param) => param.toUpperCase().startsWith('CHARSET='));
    let value = trimmed;
    if (encodingParam && encodingParam.toUpperCase() === 'ENCODING=QUOTED-PRINTABLE') {
        value = decodeQuotedPrintable(value);
    }
    if (charsetParam) {
        try {
            const charset = charsetParam.split('=')[1];
            if (charset && typeof Buffer !== 'undefined') {
                value = Buffer.from(value, 'binary').toString(charset);
            }
        }
        catch {
            // Fallback to original value
        }
    }
    return value.trim();
};
export const parseVCard = (content) => {
    if (!content) {
        return [];
    }
    const lines = unfoldLines(content.split(LINE_BREAK_REGEX));
    const entries = [];
    let currentRaw = null;
    let currentName = null;
    let currentEmails = [];
    let currentPhones = [];
    const pushEntry = () => {
        if (!currentRaw) {
            return;
        }
        entries.push({
            name: currentName,
            emails: currentEmails,
            phones: currentPhones,
            raw: currentRaw,
        });
    };
    for (const line of lines) {
        if (!line) {
            continue;
        }
        if (line.toUpperCase() === 'BEGIN:VCARD') {
            currentRaw = {};
            currentName = null;
            currentEmails = [];
            currentPhones = [];
            continue;
        }
        if (line.toUpperCase() === 'END:VCARD') {
            pushEntry();
            currentRaw = null;
            currentName = null;
            currentEmails = [];
            currentPhones = [];
            continue;
        }
        if (!currentRaw) {
            continue;
        }
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
            continue;
        }
        const rawKey = line.slice(0, separatorIndex);
        const valuePart = line.slice(separatorIndex + 1);
        const [key, ...paramParts] = rawKey.split(';');
        const upperKey = key.toUpperCase();
        const params = paramParts ?? [];
        const value = parsePropertyValue(valuePart, params);
        if (!currentRaw[upperKey]) {
            currentRaw[upperKey] = [];
        }
        currentRaw[upperKey].push(value);
        switch (upperKey) {
            case 'FN': {
                if (!currentName || currentName.length === 0) {
                    currentName = value || null;
                }
                break;
            }
            case 'N': {
                if ((!currentName || currentName.length === 0) && value) {
                    const parts = value.split(';').filter((part) => part && part.trim().length > 0);
                    if (parts.length > 0) {
                        currentName = parts.join(' ').trim();
                    }
                }
                break;
            }
            case 'EMAIL':
            case 'ITEM1.EMAIL':
            case 'ITEM2.EMAIL':
            case 'ITEM3.EMAIL': {
                if (value) {
                    currentEmails.push(value);
                }
                break;
            }
            case 'TEL':
            case 'ITEM1.TEL':
            case 'ITEM2.TEL':
            case 'ITEM3.TEL':
            case 'ITEM4.TEL': {
                if (value) {
                    currentPhones.push(value);
                }
                break;
            }
            default:
                break;
        }
    }
    return entries;
};
//# sourceMappingURL=vcard.js.map