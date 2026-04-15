import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

const TEMP_DIR = path.join(process.cwd(), 'storage/temp');
const BACKUP_DIR = path.join(process.cwd(), 'storage/backups');

export const FileService = {
    
    async saveChunk(fileId: string, chunkIndex: number, tempFilePath: string): Promise<void> {
        const chunkDir = path.join(TEMP_DIR, fileId);
        
        if (!fs.existsSync(chunkDir)) {
            await fsPromises.mkdir(chunkDir, { recursive: true });
        }

        const chunkPath = path.join(chunkDir, `chunk-${chunkIndex}`);

        try {
            await fsPromises.rename(tempFilePath, chunkPath);
        } catch (err) {
            if (fs.existsSync(tempFilePath)) await fsPromises.unlink(tempFilePath);
            throw new Error(`Error moving fragment ${chunkIndex}`);
        }
    },

    async mergeChunks(fileId: string, fileName: string): Promise<string> {
        const chunkDir = path.join(TEMP_DIR, fileId);
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
