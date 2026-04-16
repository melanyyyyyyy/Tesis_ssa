import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller.js';
import { authMiddleware, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/subject-conversations', authorize(['professor']), ChatController.getSubjectConversations);
router.get('/student-conversations', authorize(['student']), ChatController.getStudentConversations);
router.get('/conversations/:conversationId/messages', ChatController.getConversationMessages);
router.post('/conversations/:conversationId/messages', ChatController.createMessage);
router.delete('/messages/:messageId', ChatController.deleteMessage);

export default router;
