import { NextFunction, Request, Response, Router } from "express";
import { 
    uploadChunk, 
    mergeChunks, 
    restoreBackup, 
    migrateToMongo,
    syncPendingGrades,
    downloadBackup,
} from "../controllers/sigenu.controller.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { authMiddleware, authorize } from "../middlewares/auth.middleware.js";

const router = Router();
const tempDir = path.join(process.cwd(), "storage", "temp");

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        fs.mkdirSync(tempDir, { recursive: true });
        cb(null, tempDir);
    }
});

const upload = multer({ storage });

const handleChunkUpload = (req: Request, res: Response, next: NextFunction) => {
    upload.single("chunk")(req, res, (error) => {
        if (error) {
            console.error("[SIGENU] Error while receiving chunk:", error);
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Error al recibir el fragmento."
            });
        }

        next();
    });
};

router.use(authMiddleware);
router.use(authorize(['admin']));

router.post("/import/upload-chunk", handleChunkUpload, uploadChunk);
router.post("/import/merge", mergeChunks);
router.post("/import/restore", restoreBackup);
router.post("/import/migrate", migrateToMongo);

router.post("/sync/pending-grades", syncPendingGrades);
router.get("/sync/download", downloadBackup);

export default router;
