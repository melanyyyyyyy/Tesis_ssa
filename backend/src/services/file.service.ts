import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

const TEMP_DIR = path.join(process.cwd(), 'storage/temp');
const BACKUP_DIR = path.join(process.cwd(), 'storage/backups');
const RETRYABLE_FILE_ERROR_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

function getChunkDir(fileId: string): string {
    const safeFolderName = crypto.createHash('sha256').update(fileId).digest('hex');
    return path.join(TEMP_DIR, safeFolderName);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export const FileService = {
    
    async saveChunk(fileId: string, chunkIndex: number, tempFilePath: string): Promise<void> {
        const chunkDir = getChunkDir(fileId);

        if (chunkIndex === 0 && fs.existsSync(chunkDir)) {
            await fsPromises.rm(chunkDir, { recursive: true, force: true });
        }

        await fsPromises.mkdir(chunkDir, { recursive: true });

        const chunkPath = path.join(chunkDir, `chunk-${chunkIndex}`);

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                if (fs.existsSync(chunkPath)) {
                    await fsPromises.unlink(chunkPath);
                }

                await fsPromises.copyFile(tempFilePath, chunkPath);
                if (fs.existsSync(tempFilePath)) {
                    await fsPromises.unlink(tempFilePath);
                }
                return;
            } catch (err: any) {
                console.error(`[SIGENU] Failed to persist chunk ${chunkIndex} (attempt ${attempt}):`, {
                    code: err?.code,
                    message: err?.message,
                    tempFilePath,
                    chunkPath
                });

                if (attempt < 3 && RETRYABLE_FILE_ERROR_CODES.has(err?.code)) {
                    await delay(200 * attempt);
                    continue;
                }

                if (fs.existsSync(tempFilePath)) await fsPromises.unlink(tempFilePath);
                throw new Error(`Error moving fragment ${chunkIndex}`);
            }
        }
    },

    async mergeChunks(fileId: string, fileName: string): Promise<string> {
        const chunkDir = getChunkDir(fileId);
        const finalPath = path.join(BACKUP_DIR, `${Date.now()}-${fileName}`);

        if (!fs.existsSync(BACKUP_DIR)) {
            await fsPromises.mkdir(BACKUP_DIR, { recursive: true });
        }

        const chunks = await fsPromises.readdir(chunkDir);
        if (chunks.length === 0) {
            throw new Error('No chunks found to merge');
        }

        chunks.sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));

        for (const chunkName of chunks) {
            const chunkPath = path.join(chunkDir, chunkName);
            const readStream = fs.createReadStream(chunkPath);

            const appendStream = fs.createWriteStream(finalPath, { flags: 'a' });

            await pipeline(readStream, appendStream);
            
            await fsPromises.unlink(chunkPath);
        }

        await fsPromises.rm(chunkDir, { recursive: true, force: true });
        
        return finalPath;
    },

    async deleteFile(filePath: string): Promise<void> {
        if (fs.existsSync(filePath)) {
            await fsPromises.unlink(filePath);
        }
    }
};
