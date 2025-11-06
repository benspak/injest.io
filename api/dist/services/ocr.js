import Tesseract from 'tesseract.js';
import fs from 'fs';
export class OCRService {
    /**
     * Extract text from an image using OCR
     */
    async extractTextFromImage(imagePath) {
        try {
            // Check if file exists
            if (!fs.existsSync(imagePath)) {
                throw new Error(`Image file not found: ${imagePath}`);
            }
            // Perform OCR on the image
            const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
                logger: (m) => {
                    // Only log progress for debugging if needed
                    if (process.env.NODE_ENV === 'development' && m.status === 'recognizing text') {
                        console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            });
            // Clean up the extracted text
            const cleanedText = text.trim().replace(/\n{3,}/g, '\n\n'); // Replace multiple newlines with double newline
            return cleanedText;
        }
        catch (error) {
            console.error(`[OCR] Error extracting text from image ${imagePath}:`, error);
            throw new Error(`OCR failed: ${error.message}`);
        }
    }
    /**
     * Check if a file is an image based on mimetype or extension
     */
    isImage(mimetype, filename) {
        if (mimetype && mimetype.startsWith('image/')) {
            return true;
        }
        if (filename) {
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
            const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
            return imageExtensions.includes(ext);
        }
        return false;
    }
}
export const ocrService = new OCRService();
//# sourceMappingURL=ocr.js.map