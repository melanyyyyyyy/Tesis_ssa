import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { Client } from 'pg';
import path from 'path';
import { ENV } from '../config/envs.js';

const execPromise = promisify(exec);

const dbConfig = {
    user: ENV.DB_USER || 'postgres',
    host: ENV.DB_HOST || 'localhost',
    password: ENV.DB_PASSWORD || 'admin',
    port: ENV.DB_PORT || 5432,
    importDb: ENV.DB_NAME || 'sigenu_import'
};

export const DatabaseService = {
    async restoreDatabase(backupPath: string): Promise<void> {
        const adminClient = new Client({
            ...dbConfig,
            database: 'postgres'
        });

        try {
            await adminClient.connect();
            const checkRes = await adminClient.query(
                "SELECT 1 FROM pg_database WHERE datname = $1",
                [dbConfig.importDb]
            );

            if (checkRes.rowCount === 0) {
                console.log(`[DB Setup] Creating database "${dbConfig.importDb}"...`);
                await adminClient.query(`CREATE DATABASE "${dbConfig.importDb}" WITH ENCODING 'UTF8'`);
            }
        } catch (err) {
            console.error("[DB Setup Error] Infrastructure failure:", err);
            throw new Error("Could not prepare PostgreSQL environment.");
        } finally {
            await adminClient.end();
        }

        const command = `pg_restore -h "${dbConfig.host}" -p ${dbConfig.port} -U "${dbConfig.user}" -d "${dbConfig.importDb}" --clean --if-exists --no-owner --no-privileges "${backupPath}"`;

        try {
            console.log(`[DB Restore] Restoring to: ${dbConfig.importDb}...`);

            await execPromise(command, {
                env: { ...process.env, PGPASSWORD: dbConfig.password }
            });

            console.log(`[DB Restore Success] Data is ready in PostgreSQL.`);
        } catch (error: any) {
            if (error.code === 1) {
                console.warn(`[DB Restore Warning] pg_restore finished with warnings (code 1). Check logs if necessary.`);
                return;
            }

            console.error(`[DB Restore Error] Fatal error during pg_restore:`, error.message);
            throw new Error(`Critical failure while restoring backup file: ${error.message}`);
        }
    },

    async getRows(sql: string, params: any[] = []): Promise<any[]> {
        const client = new Client({
            ...dbConfig,
            database: dbConfig.importDb
        });

        try {
            await client.connect();
            const res = await client.query(sql, params);
            return res.rows;
        } catch (err: any) {
            console.error(`[DB Query Error] Failed to fetch data:`, err.message);
            throw new Error(`Database query failed: ${err.message}`);
        } finally {
            await client.end();
        }
    },

    async execute(sql: string, params: any[] = []): Promise<any> {
        const client = new Client({
            ...dbConfig,
            database: dbConfig.importDb
        });

        try {
            await client.connect();
            const res = await client.query(sql, params);
            return res;
        } catch (err: any) {
            console.error(`[DB Execute Error] Failed to execute query:`, err.message);
            throw new Error(`Database execution failed: ${err.message}`);
        } finally {
            await client.end();
        }
    },

    async createBackup(): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `sigenu_export_${timestamp}.backup`;

        const backupPath = path.resolve(process.cwd(), 'uploads', fileName);

        const fs = await import('fs/promises');
        await fs.mkdir(path.dirname(backupPath), { recursive: true });

        const command = `pg_dump -h "${dbConfig.host}" -p ${dbConfig.port} -U "${dbConfig.user}" -d "${dbConfig.importDb}" -F c -b -v -f "${backupPath}"`;

        const adminClient = new Client({
            ...dbConfig,
            database: dbConfig.importDb
        });

        try {
            await adminClient.connect();
            await adminClient.end();

            console.log(`[DB Backup] Creating backup at: ${backupPath}...`);

            await new Promise<void>((resolve, reject) => {
                const child = spawn('pg_dump', [
                    '-h', dbConfig.host,
                    '-p', dbConfig.port.toString(),
                    '-U', dbConfig.user,
                    '-d', dbConfig.importDb,
                    '-F', 'c',
                    '-b',
                    '-v',
                    '-f', backupPath
                ], {
                    env: { ...process.env, PGPASSWORD: dbConfig.password }
                });

                let errorMsg = '';

                child.stderr.on('data', (data) => {
                    errorMsg += data.toString();
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(errorMsg || `pg_dump process exited with code ${code}`));
                    }
                });

                child.on('error', (err) => reject(err));
            });

            console.log(`[DB Backup Success] Backup created successfully.`);
            return fileName;
        } catch (error: any) {
            console.error(`[DB Backup Error] Fatal error during pg_dump:`, error.message);
            if (error.code === '3D000') {
                throw new Error(`DatabaseNotFound: ${error.message}`);
            }
            throw new Error(`Critical failure while creating backup file: ${error.message}`);
        }
    }
}