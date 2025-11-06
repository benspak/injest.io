export declare class OCRService {
    /**
     * Extract text from an image using OCR
     */
    extractTextFromImage(imagePath: string): Promise<string>;
    /**
     * Check if a file is an image based on mimetype or extension
     */
    isImage(mimetype?: string, filename?: string): boolean;
}
export declare const ocrService: OCRService;
//# sourceMappingURL=ocr.d.ts.map