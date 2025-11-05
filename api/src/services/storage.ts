import fs from 'fs';
import path from 'path';

export class FileStorageService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getFilePath(filename: string): string {
    return path.join(this.uploadDir, filename);
  }

  async saveFile(file: Express.Multer.File, newFilename?: string): Promise<string> {
    const filename = newFilename || file.filename;
    const filePath = this.getFilePath(filename);

    if (file.path !== filePath) {
      fs.renameSync(file.path, filePath);
    }

    return filename;
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = this.getFilePath(filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async getFileStream(filename: string): Promise<fs.ReadStream> {
    const filePath = this.getFilePath(filename);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    return fs.createReadStream(filePath);
  }
}

export const fileStorageService = new FileStorageService();
