import { Request, Response } from 'express';
import { FileService } from '../services/file.service.js';
import { DatabaseService } from '../services/database.service.js';
import { MigrationService } from '../services/migration.service.js';
import { SyncService } from '../services/sync.service.js';
import path from 'path';
import fs from 'fs';

export async function uploadChunk(req: Request, res: Response) {
    try {
        const { fileId, chunkIndex } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: "No file chunk received." });
        }

        await FileService.saveChunk(fileId, parseInt(chunkIndex), file.path);
        return res.status(200).json({ message: "Chunk uploaded successfully" });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

export async function mergeChunks(req: Request, res: Response) {
    try {
        const { fileId, fileName } = req.body;
        const backupPath = await FileService.mergeChunks(fileId, fileName);
        return res.status(200).json({ message: "Chunks merged", backupPath });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

export async function restoreBackup(req: Request, res: Response) {
    try {
        const { backupPath } = req.body;
        await DatabaseService.restoreDatabase(backupPath);
        return res.status(200).json({ message: "Postgres restore completed" });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

export async function migrateToMongo(req: Request, res: Response) {
    try {
        const { backupPath } = req.body;

        await MigrationService.migrateAll();

        if (backupPath) {
            try {
                await FileService.deleteFile(backupPath);
                console.log(`Temporary file deleted: ${backupPath}`);
            } catch (fileError) {
                console.warn('Could not delete backup file, but migration finished successfully.');
            }
        }

        return res.status(200).json({
            success: true,
            message: "Migration completed successfully. All catalogs and records have been synchronized."
        });

    } catch (error: any) {
        console.error('Error in migrateToMongo:', error);
        return res.status(500).json({
            success: false,
            error: error.message || "An unexpected error occurred during the migration process."
        });
    }
}

export async function syncPendingGrades(req: Request, res: Response) {
    try {
        const result = await SyncService.syncPendingGrades();
        return res.status(200).json({
            success: true,
            message: "Synchronization completed successfully.",
            data: result
        });
    } catch (error: any) {
        console.error('Error in syncPendingGrades:', error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to synchronize pending grades."
        });
    }
}

export async function downloadBackup(req: Request, res: Response) {
    let backupFile: string | undefined;
    let fileStream: any = null;
    
    try {
        backupFile = req.query.backupFile as string;
        
        if (!backupFile || typeof backupFile !== 'string' || backupFile.trim() === '') {
            console.warn('[Download] Invalid backup file parameter');
            return res.status(400).json({ error: "Backup file is required." });
        }

        const sanitizedFile = backupFile.replace(/\.\./g, '').replace(/\\/g, '/');
        
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        const resolvedPath = path.join(uploadsDir, sanitizedFile);

        console.log(`[Download] Request for file: ${backupFile}`);
        console.log(`[Download] Resolved path: ${resolvedPath}`);

        const normalizedResolved = path.normalize(resolvedPath);
        const normalizedUploads = path.normalize(uploadsDir);
        
        if (!normalizedResolved.startsWith(normalizedUploads)) {
            console.warn(`[Download] Security violation: path traversal attempt`);
            return res.status(403).json({ error: "Acceso denegado." });
        }

        if (!fs.existsSync(resolvedPath)) {
            console.error(`[Download] File not found: ${resolvedPath}`);
            return res.status(404).json({ error: "Archivo no encontrado." });
        }

        const stats = fs.statSync(resolvedPath);
        if (!stats.isFile()) {
            console.error(`[Download] Not a file: ${resolvedPath}`);
            return res.status(400).json({ error: "El recurso no es un archivo." });
        }

        const fileSize = stats.size;
        console.log(`[Download] File size: ${fileSize} bytes`);

        if (fileSize === 0) {
            console.warn(`[Download] File is empty: ${resolvedPath}`);
            return res.status(400).json({ error: "El archivo está vacío." });
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFile}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Transfer-Encoding', 'chunked');

        console.log(`[Download] Starting to send file: ${sanitizedFile} (${fileSize} bytes)`);

        fileStream = fs.createReadStream(resolvedPath, {
            highWaterMark: 256 * 1024 
        });

        fileStream.on('open', () => {
            console.log(`[Download] File stream opened for: ${sanitizedFile}`);
        });

        fileStream.on('error', (streamError: any) => {
            console.error(`[Download] Stream error reading file ${resolvedPath}:`, streamError.message);
            if (!res.headersSent) {
                res.status(500).json({ error: "Error al leer el archivo." });
            } else {
                res.destroy();
            }
        });

        res.on('error', (responseError: any) => {
            console.error(`[Download] Response error for ${sanitizedFile}:`, responseError.message);
            if (fileStream) {
                fileStream.destroy();
            }
        });

        res.on('finish', () => {
            console.log(`[Download] Response finished successfully for: ${sanitizedFile}`);
        });

        res.on('close', () => {
            console.log(`[Download] Response closed for: ${sanitizedFile}`);
            if (fileStream) {
                fileStream.destroy();
            }
        });

        fileStream.pipe(res);

    } catch (error: any) {
        console.error('[Download] Unexpected error:', error.message);
        if (fileStream) {
            fileStream.destroy();
        }
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || "Error al procesar la descarga." });
        } else {
            res.end();
        }
    }
}