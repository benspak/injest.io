import fs from 'fs';
import path from 'path';
export class FileStorageService {
    uploadDir;
    constructor() {
        this.uploadDir = process.env.UPLOAD_DIR || './uploads';
        this.ensureUploadDir();
    }
    ensureUploadDir() {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    getFilePath(filename) {
        return path.join(this.uploadDir, filename);
    }
    async saveFile(file, newFilename) {
        const filename = newFilename || file.filename;
        const filePath = this.getFilePath(filename);
        if (file.path !== filePath) {
            fs.renameSync(file.path, filePath);
        }
        return filename;
    }
    async deleteFile(filename) {
        const filePath = this.getFilePath(filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    async getFileStream(filename) {
        const filePath = this.getFilePath(filename);
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }
        return fs.createReadStream(filePath);
    }
}
export const fileStorageService = new FileStorageService();
//# sourceMappingURL=storage.js.map