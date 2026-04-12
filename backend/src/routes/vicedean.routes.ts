import { Router } from 'express';
import { authMiddleware, authorize } from '../middlewares/auth.middleware.js';
import {
  assignProfessorToSubject,
  getVicedeanCareers,
  getVicedeanCourseTypes,
  getVicedeanProfile,
  getVicedeanProfessors,
  getVicedeanSubjects,
  getProfessorRequests,
  approveProfessorRequest,
  rejectProfessorRequest
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

// Professor Requests
router.get('/professor-requests', getProfessorRequests);
router.post('/professor-requests/:userId/approve', approveProfessorRequest);
router.post('/professor-requests/:userId/reject', rejectProfessorRequest);

export default router;
