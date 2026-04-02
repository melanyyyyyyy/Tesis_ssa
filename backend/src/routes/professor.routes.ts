import { Router } from 'express';
import {
    getProfessorSubjects,
    getSubjectStudentsSummary
} from '../controllers/professor.controller.js';
import { authMiddleware, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authMiddleware);
router.use(authorize(['professor']));

router.get('/subjects', getProfessorSubjects);
router.get('/subject-students', getSubjectStudentsSummary);

export default router;

