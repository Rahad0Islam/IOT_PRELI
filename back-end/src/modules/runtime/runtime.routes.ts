/**
 * modules/runtime/runtime.routes.ts
 */

import { Router } from 'express';
import { runtimeController } from './runtime.controller.js';

const router = Router();

router.get('/', runtimeController.snapshot);
router.get('/history', runtimeController.history);

export const runtimeRoutes = router;