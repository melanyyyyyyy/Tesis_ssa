import { Router } from 'express';
import { 
    getDashboardStats,
    getSecretaryProfile,
    getFaculties,
    getCareers,
    getCourseTypes,
    getStudents,
    getEvaluations,
    getSubjects,
    getMatriculatedSubjects,
    getEvaluationValues,
    getExaminationTypes,
    getStudentStatuses
} from '../controllers/secretary.controller.js';
import { authMiddleware, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);
router.use(authorize(['secretary']));

router.get('/sigenu-stats', getDashboardStats);
router.get('/profile', getSecretaryProfile);
router.get('/faculties', getFaculties); //
router.get('/careers', getCareers); //
router.get('/course-types', getCourseTypes);  //
router.get('/students', getStudents);
router.get('/evaluations', getEvaluations);
router.get('/subjects', getSubjects);
router.get('/matriculated-subjects', getMatriculatedSubjects);
router.get('/evaluation-values', getEvaluationValues);
router.get('/examination-types', getExaminationTypes);
router.get('/student-statuses', getStudentStatuses);

export default router;

