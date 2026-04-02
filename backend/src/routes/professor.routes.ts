import { Router } from 'express';
import { getProfessorSubjects } from '../controllers/professor.controller.js';
import { authMiddleware, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authMiddleware);
router.use(authorize(['professor']));

router.get('/subjects', getProfessorSubjects);

export default router;

