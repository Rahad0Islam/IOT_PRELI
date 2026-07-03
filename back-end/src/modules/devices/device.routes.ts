/**
 * modules/devices/device.routes.ts
 */

import { Router } from 'express';

import { deviceController } from './device.controller.js';
import { toggleValidator } from './device.validator.js';

const router = Router();

router.get('/', deviceController.list);
router.get('/rooms', deviceController.rooms);
router.get('/rooms/:room', deviceController.room);
router.get('/:id', deviceController.getOne);
router.post('/toggle', toggleValidator, deviceController.toggle);

export const deviceRoutes = router;
