import { Router } from 'express';
import { authMiddleware, authorize } from '../middlewares/auth.middleware.js';
import {
    getStudentAcademicRanking,
    getStudentRecordsSummary,
    getStudentSubjectAttendanceRecords,
    getStudentSubjectEvaluationRecords
} from '../controllers/student.controller.js';

const router = Router();
router.use(authMiddleware);
router.use(authorize(['student']));

router.get('/records-summary', getStudentRecordsSummary);
router.get('/academic-ranking', getStudentAcademicRanking);
router.get('/subject-evaluation-records', getStudentSubjectEvaluationRecords);
router.get('/subject-attendance-records', getStudentSubjectAttendanceRecords);

export default router;
