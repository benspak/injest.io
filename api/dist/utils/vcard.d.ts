export interface ParsedVCardEntry {
    name: string | null;
    emails: string[];
    phones: string[];
    raw: Record<string, string[]>;
}
export declare const parseVCard: (content: string) => ParsedVCardEntry[];
//# sourceMappingURL=vcard.d.ts.map