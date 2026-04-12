import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', AuthController.login);
router.get('/faculties', AuthController.getFaculties);
router.post('/role-request', AuthController.createRoleRequest);

export default router;
