import { Router } from 'express';
import { 
    getSecretaryProfile,
    getFaculties,
    getCareers,
    getCourseTypes
} from '../controllers/secretary.controller.js';
import { authMiddleware, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);
router.use(authorize(['secretary']));

router.get('/profile', getSecretaryProfile);
router.get('/faculties', getFaculties); //
router.get('/careers', getCareers); //
router.get('/course-types', getCourseTypes);  //

export default router;

