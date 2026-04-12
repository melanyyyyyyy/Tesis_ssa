import { Router } from 'express';
import { 
    getDashboardStats, 
    getPendingGradesCount, 
    getPendingGradesList, 
    getLastExportGradesList,
    getFacultyAssignmentUsers,
    getRoleManagementUsers,
    updateFacultyAssignmentUser,
    updateRoleManagementUser,
    approveRoleRequest,
    rejectRoleRequest,
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
} from '../controllers/admin.controller.js';
import { authMiddleware, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);
router.use(authorize(['admin']));

router.get('/sigenu-stats', getDashboardStats);
router.get('/faculty-assignment-users', getFacultyAssignmentUsers);
router.put('/faculty-assignment-users/:id', updateFacultyAssignmentUser);
router.get('/role-management-users', getRoleManagementUsers);
router.put('/role-management-users/:id', updateRoleManagementUser);
router.post('/role-requests/:requestId/approve', approveRoleRequest);
router.post('/role-requests/:requestId/reject', rejectRoleRequest);
router.get('/pending-grades-count', getPendingGradesCount);
router.get('/pending-grades', getPendingGradesList);
router.get('/last-export-grades', getLastExportGradesList);
router.delete('/evaluation/:id', deleteEvaluation);

router.post('/evaluation', createEvaluation);
router.put('/evaluation/:id', updateEvaluation);
router.get('/matriculated-subjects', getMatriculatedSubjects);
router.get('/evaluation-values', getEvaluationValues);
router.get('/examination-types', getExaminationTypes);
router.get('/faculties', getFaculties); //
router.get('/careers', getCareers); //
router.get('/course-types', getCourseTypes);  //
router.get('/students', getStudents);
router.get('/evaluations', getEvaluations);
router.get('/subjects', getSubjects);
router.get('/student-statuses', getStudentStatuses);

export default router;
