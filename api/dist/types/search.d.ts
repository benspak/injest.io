export interface SearchFilters {
    entities?: Array<'item' | 'contact'>;
    types?: string[];
    tags?: string[];
    uploadedBy?: 'me' | 'shared' | 'all';
    dateFrom?: string;
    dateTo?: string;
    hasAttachments?: boolean;
    sources?: string[];
    fileType?: string;
}
//# sourceMappingURL=search.d.ts.map