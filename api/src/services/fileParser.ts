import fs from 'fs';
import path from 'path';
import { fileStorageService } from './storage.js';
import { ocrService } from './ocr.js';
import { openAIService } from './openai.js';

export interface ParsedFileContent {
  text: string;
  title?: string; // Optional title (used for images when Vision API is used)
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    source?: 'ocr' | 'vision'; // Indicates whether description came from OCR or Vision API
  };
}

export class FileParserService {
  /**
   * Extract text content from a file based on its type
   */
  async parseFile(filename: string, mimetype?: string): Promise<ParsedFileContent> {
    const filePath = fileStorageService.getFilePath(filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filename}`);
    }

    // Determine file type from mimetype or extension
    const ext = path.extname(filename).toLowerCase();
    const type = mimetype || this.getMimeTypeFromExtension(ext);

    try {
      // Handle different file types
      if (type?.includes('text/') || ext === '.txt' || ext === '.md') {
        return await this.parseTextFile(filePath);
      }

      if (ext === '.csv') {
        return await this.parseCsvFile(filePath);
      }

      if (type?.includes('application/json') || ext === '.json') {
        return await this.parseJsonFile(filePath);
      }

      if (type?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || ext === '.docx') {
        return await this.parseDocxFile(filePath);
      }

      if (type?.includes('application/pdf') || ext === '.pdf') {
        return await this.parsePdfFile(filePath);
      }

      // Handle image files with OCR
      if (ocrService.isImage(type, filename)) {
        return await this.parseImageFile(filePath);
      }

      // Fallback: try to read as text
      return await this.parseTextFile(filePath);
    } catch (error: any) {
      console.error(`Error parsing file ${filename}:`, error);
      // Return empty content rather than failing completely
      return { text: '', metadata: {} };
    }
  }

  private async parseTextFile(filePath: string): Promise<ParsedFileContent> {
    const text = fs.readFileSync(filePath, 'utf-8');
    return {
      text: text.trim(),
      metadata: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
      },
    };
  }

  private async parseCsvFile(filePath: string): Promise<ParsedFileContent> {
    const text = fs.readFileSync(filePath, 'utf-8');
    const lines = text.split('\n').filter(Boolean);
    // Take first few rows as content summary
    const preview = lines.slice(0, 10).join('\n');
    return {
      text: preview,
      metadata: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
      },
    };
  }

  private async parseJsonFile(filePath: string): Promise<ParsedFileContent> {
    const text = fs.readFileSync(filePath, 'utf-8');
    try {
      const json = JSON.parse(text);
      // Convert JSON to readable text format
      const readableText = JSON.stringify(json, null, 2);
      return {
        text: readableText,
        metadata: {
          wordCount: readableText.split(/\s+/).filter(Boolean).length,
        },
      };
    } catch {
      return { text: text.trim(), metadata: {} };
    }
  }

  private async parseDocxFile(filePath: string): Promise<ParsedFileContent> {
    try {
      // Try to use mammoth if available
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return {
        text: result.value.trim(),
        metadata: {
          wordCount: result.value.split(/\s+/).filter(Boolean).length,
        },
      };
    } catch (error) {
      // If mammoth is not available, return empty
      console.warn('mammoth not available for DOCX parsing, install with: npm install mammoth');
      return { text: '', metadata: {} };
    }
  }

  private async parsePdfFile(filePath: string): Promise<ParsedFileContent> {
    try {
      // Try to use pdf-parse if available
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return {
        text: data.text.trim(),
        metadata: {
          pageCount: data.numpages,
          wordCount: data.text.split(/\s+/).filter(Boolean).length,
        },
      };
    } catch (error) {
      // If pdf-parse is not available, return empty
      console.warn('pdf-parse not available for PDF parsing, install with: npm install pdf-parse');
      return { text: '', metadata: {} };
    }
  }

  private async parseImageFile(filePath: string): Promise<ParsedFileContent> {
    try {
      // First attempt OCR to extract text from image
      const text = await ocrService.extractTextFromImage(filePath);

      // If OCR returns meaningful text (more than 10 characters), use it
      if (text && text.trim().length > 10) {
        return {
          text: text,
          metadata: {
            wordCount: text.split(/\s+/).filter(Boolean).length,
            source: 'ocr',
          },
        };
      }

      // If OCR returns minimal or no text, use Vision API to generate description
      // This handles images with no text content (photos, illustrations, etc.)
      try {
        const filename = path.basename(filePath);
        const visionResult = await openAIService.generateImageDescriptionAndTitle(filePath, filename);

        // Use the description from Vision API as the text content
        const description = visionResult.description || 'Image description unavailable';

        return {
          text: description,
          title: visionResult.title, // Store title for use in items route
          metadata: {
            wordCount: description.split(/\s+/).filter(Boolean).length,
            source: 'vision',
          },
        };
      } catch (visionError: any) {
        // If Vision API fails, log but don't fail - return OCR text or empty
        console.warn(`Vision API failed for image ${filePath}:`, visionError.message);
        return {
          text: text || '',
          metadata: {
            wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
            source: 'ocr',
          },
        };
      }
    } catch (error: any) {
      // If OCR fails completely, try Vision API as fallback
      console.warn(`OCR failed for image ${filePath}:`, error.message);

      try {
        const filename = path.basename(filePath);
        const visionResult = await openAIService.generateImageDescriptionAndTitle(filePath, filename);
        const description = visionResult.description || 'Image description unavailable';

        return {
          text: description,
          title: visionResult.title, // Store title for use in items route
          metadata: {
            wordCount: description.split(/\s+/).filter(Boolean).length,
            source: 'vision',
          },
        };
      } catch (visionError: any) {
        // If both OCR and Vision API fail, return empty
        console.warn(`Both OCR and Vision API failed for image ${filePath}:`, visionError.message);
        return { text: '', metadata: {} };
      }
    }
  }

  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Extract a summary/preview of the file content (first N characters)
   */
  extractPreview(content: string, maxLength: number = 500): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }
}

export const fileParserService = new FileParserService();
