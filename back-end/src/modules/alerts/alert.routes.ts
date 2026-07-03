/**
 * modules/alerts/alert.routes.ts
 */

import { Router } from 'express';
import { alertController } from './alert.controller.js';

const router = Router();

router.get('/', alertController.list);
router.delete('/', alertController.clear);

export const alertRoutes = router;