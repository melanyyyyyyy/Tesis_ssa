import { Router } from 'express';
import { 
    getDashboardStats, 
    getPendingGradesCount, 
    getPendingGradesList, 
    getLastExportGradesList,
    deleteEvaluation,
    createEvaluation,
    updateEvaluation,
    getMatriculatedSubjects,
    getEvaluationValues,
    getExaminationTypes,
    getFaculties,
    getCareers,
    getCourseTypes,
    getStudents,
    getEvaluations,
    getSubjects,
    getStudentStatuses
} from '../controllers/secretary.controller.js';
import { authMiddleware, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);
router.use(authorize(['secretary']));

router.get('/sigenu-stats', getDashboardStats);
router.get('/pending-grades-count', getPendingGradesCount);
router.get('/pending-grades', getPendingGradesList);
router.get('/last-export-grades', getLastExportGradesList);
router.delete('/evaluation/:id', deleteEvaluation);

router.post('/evaluation', createEvaluation);
router.put('/evaluation/:id', updateEvaluation);
router.get('/matriculated-subjects', getMatriculatedSubjects);
router.get('/evaluation-values', getEvaluationValues);
router.get('/examination-types', getExaminationTypes);
router.get('/faculties', getFaculties);
router.get('/careers', getCareers);
router.get('/course-types', getCourseTypes);
router.get('/students', getStudents);
router.get('/evaluations', getEvaluations);
router.get('/subjects', getSubjects);
router.get('/student-statuses', getStudentStatuses);

export default router;
