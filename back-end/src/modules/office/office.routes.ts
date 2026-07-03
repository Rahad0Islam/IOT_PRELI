/**
 * modules/office/office.routes.ts
 */

import { Router } from 'express';
import { officeController } from './office.controller.js';

const router = Router();

router.get('/', officeController.info);
router.put('/hours', officeController.setHours);

export const officeRoutes = router;