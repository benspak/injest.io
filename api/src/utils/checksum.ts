import crypto from 'crypto';
import fs from 'fs';

/**
 * Compute a SHA-256 checksum for a file at the given path.
 * Streams the file to avoid loading large files into memory.
 */
export async function computeFileChecksum(filePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('error', reject);
    hash.on('error', reject);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
  });
}
