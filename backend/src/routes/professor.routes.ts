import { Router } from 'express';
import {
    getAcademicRanking,
    getProfessorSubjects,
    getStudentAttendanceRecords,
    getStudentEvaluationRecords,
    getSubjectAttendanceRegisterData,
    getSubjectEvaluationRegisterData,
    getSubjectStudentsSummary,
    upsertSubjectAttendanceRegister,
    upsertSubjectEvaluationRegister
} from '../controllers/professor.controller.js';
import { authMiddleware, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authMiddleware);
router.use(authorize(['professor']));

router.get('/subjects', getProfessorSubjects);
router.get('/subject-students', getSubjectStudentsSummary);
router.get('/academic-ranking', getAcademicRanking);
router.get('/student-evaluation-records', getStudentEvaluationRecords);
router.get('/student-attendance-records', getStudentAttendanceRecords);
router.get('/evaluation-register-data', getSubjectEvaluationRegisterData);
router.post('/evaluation-register', upsertSubjectEvaluationRegister);
router.get('/attendance-register-data', getSubjectAttendanceRegisterData);
router.post('/attendance-register', upsertSubjectAttendanceRegister);

export default router;

