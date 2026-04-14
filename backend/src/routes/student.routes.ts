import { Router } from 'express';
import { authMiddleware, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authMiddleware);
router.use(authorize(['student']));

export default router;