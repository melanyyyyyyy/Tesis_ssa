import { Router } from 'express';
import {
  getUserProfile,
  getUserNotifications,
  getExamCalendarEvents,
  getSubjectsByCareer,
  getExaminationTypes,
  createExamCalendarEvent,
  deleteExamCalendarEvent
} from '../controllers/common.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/profile', getUserProfile);
router.get('/notifications', getUserNotifications);

router.get('/exam-calendars', getExamCalendarEvents);
router.post('/exam-calendars', createExamCalendarEvent);
router.delete('/exam-calendars/:id', deleteExamCalendarEvent);
router.get('/subjects', getSubjectsByCareer);
router.get('/examination-types', getExaminationTypes);

export default router;
