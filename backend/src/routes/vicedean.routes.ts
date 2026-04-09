import { Router } from 'express';
import { authMiddleware, authorize } from '../middlewares/auth.middleware.js';
import {
  assignProfessorToSubject,
  getVicedeanCareers,
  getVicedeanCourseTypes,
  getVicedeanProfile,
  getVicedeanProfessors,
  getVicedeanSubjects
} from '../controllers/vicedean.controller.js';

const router = Router();
router.use(authMiddleware);
router.use(authorize(['vicedean']));

router.get('/profile', getVicedeanProfile);
router.get('/course-types', getVicedeanCourseTypes);
router.get('/careers', getVicedeanCareers);
router.get('/professors', getVicedeanProfessors);
router.get('/subjects', getVicedeanSubjects);
router.put('/subjects/:subjectId/professor', assignProfessorToSubject);

export default router;
