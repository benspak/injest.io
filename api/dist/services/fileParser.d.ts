export interface ParsedFileContent {
    text: string;
    title?: string;
    metadata?: {
        pageCount?: number;
        wordCount?: number;
        source?: 'ocr' | 'vision';
    };
}
export declare class FileParserService {
    /**
     * Extract text content from a file based on its type
     */
    parseFile(filename: string, mimetype?: string): Promise<ParsedFileContent>;
    private parseTextFile;
    private parseCsvFile;
    private parseJsonFile;
    private parseDocxFile;
    private parsePdfFile;
    private parseImageFile;
    private getMimeTypeFromExtension;
    /**
     * Extract a summary/preview of the file content (first N characters)
     */
    extractPreview(content: string, maxLength?: number): string;
}
export declare const fileParserService: FileParserService;
//# sourceMappingURL=fileParser.d.ts.map