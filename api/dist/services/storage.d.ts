import fs from 'fs';
export declare class FileStorageService {
    private uploadDir;
    constructor();
    private ensureUploadDir;
    getFilePath(filename: string): string;
    saveFile(file: Express.Multer.File, newFilename?: string): Promise<string>;
    deleteFile(filename: string): Promise<void>;
    getFileStream(filename: string): Promise<fs.ReadStream>;
}
export declare const fileStorageService: FileStorageService;
//# sourceMappingURL=storage.d.ts.map