import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { createMonitor, listMonitors, getMonitor, cancelMonitor } from '../controllers/regionalUptimeMonitorController.js';

const router = express.Router();
router.use(protect, allowRoles('platform_client', 'both'));
router.post('/', createMonitor);
router.get('/', listMonitors);
router.get('/:id', getMonitor);
router.delete('/:id', cancelMonitor);

export default router;
