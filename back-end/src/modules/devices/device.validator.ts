/**
 * modules/devices/device.validator.ts
 *
 * express-validator chain for POST /api/device/toggle.
 */

import { body } from 'express-validator';

export const toggleValidator = [
  body('identifier')
    .exists({ values: 'falsy' })
    .withMessage('identifier is required')
    .isString()
    .withMessage('identifier must be a string')
    .trim()
    .notEmpty()
    .withMessage('identifier cannot be empty'),
  body('status')
    .optional()
    .isIn(['ON', 'OFF'])
    .withMessage('status must be ON or OFF'),
];
