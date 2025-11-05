export interface LinkMetadata {
    title?: string;
    description?: string;
    image?: string;
    url: string;
}
export declare class LinkMetadataService {
    fetchMetadata(url: string): Promise<LinkMetadata>;
}
export declare const linkMetadataService: LinkMetadataService;
//# sourceMappingURL=linkMetadata.d.ts.map