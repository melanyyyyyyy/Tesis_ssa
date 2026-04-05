import { Router } from 'express';
import {
    getAcademicRanking,
    getProfessorSubjects,
    getSubjectEvaluationHistory,
    getSubjectAttendanceHistory,
    getStudentAttendanceRecords,
    getStudentEvaluationRecords,
    getSubjectAttendanceRegisterData,
    getSubjectEvaluationRegisterData,
    getSubjectStudentsSummary,
    upsertSubjectAttendanceRegister,
    upsertSubjectEvaluationRegister,
    deleteSubjectEvaluationBatch,
    deleteSubjectAttendanceBatch
} from '../controllers/professor.controller.js';
import { authMiddleware, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authMiddleware);
router.use(authorize(['professor']));

router.get('/subjects', getProfessorSubjects);
router.get('/subject-evaluation-history', getSubjectEvaluationHistory);
router.get('/subject-attendance-history', getSubjectAttendanceHistory);
router.get('/subject-students', getSubjectStudentsSummary);
router.get('/academic-ranking', getAcademicRanking);
router.get('/student-evaluation-records', getStudentEvaluationRecords);
router.get('/student-attendance-records', getStudentAttendanceRecords);
router.get('/evaluation-register-data', getSubjectEvaluationRegisterData);
router.post('/evaluation-register', upsertSubjectEvaluationRegister);
router.delete('/evaluation-batch', deleteSubjectEvaluationBatch);
router.get('/attendance-register-data', getSubjectAttendanceRegisterData);
router.post('/attendance-register', upsertSubjectAttendanceRegister);
router.delete('/attendance-batch', deleteSubjectAttendanceBatch);

export default router;

