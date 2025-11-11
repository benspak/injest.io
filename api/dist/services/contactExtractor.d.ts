export interface ContactCandidate {
    name?: string | null;
    email?: string | null;
    metadata?: Record<string, unknown>;
}
export declare class ContactExtractorService {
    extract(text: string): ContactCandidate[];
}
export declare const contactExtractor: ContactExtractorService;
//# sourceMappingURL=contactExtractor.d.ts.map