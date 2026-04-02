import { Router } from "express";
import { 
    uploadChunk, 
    mergeChunks, 
    restoreBackup, 
    migrateToMongo,
    syncPendingGrades,
    downloadBackup,
} from "../controllers/sigenu.controller.js";
import multer from "multer";
import { authMiddleware, authorize } from "../middlewares/auth.middleware.js";

const router = Router();
const upload = multer({ dest: 'storage/temp/' });

router.use(authMiddleware);
router.use(authorize(['secretary']));

router.post("/import/upload-chunk", upload.single('chunk'), uploadChunk);
router.post("/import/merge", mergeChunks);
router.post("/import/restore", restoreBackup);
router.post("/import/migrate", migrateToMongo);

router.post("/sync/pending-grades", syncPendingGrades);
router.get("/sync/download", downloadBackup);

export default router;