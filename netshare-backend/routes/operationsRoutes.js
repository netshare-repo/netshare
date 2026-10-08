import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { listAlerts, reviewAlert, listDisputes, createDispute, reviewDispute, getReport,
  listNotifications, readNotification, readAllNotifications } from '../controllers/operationsController.js';

export const adminOperationsRoutes = express.Router();
adminOperationsRoutes.use(protect, allowRoles('admin'));
adminOperationsRoutes.get('/alerts', listAlerts);
adminOperationsRoutes.put('/alerts/:id/review', reviewAlert);
adminOperationsRoutes.get('/reports', getReport);
adminOperationsRoutes.get('/reports/export', getReport);
adminOperationsRoutes.get('/disputes', listDisputes);
adminOperationsRoutes.put('/disputes/:id/review', reviewDispute);
export const disputeRoutes = express.Router();
disputeRoutes.use(protect);
disputeRoutes.get('/', listDisputes);
disputeRoutes.post('/', createDispute);
export const notificationRoutes = express.Router();
notificationRoutes.use(protect);
notificationRoutes.get('/', listNotifications);
notificationRoutes.put('/read-all', readAllNotifications);
notificationRoutes.put('/:id/read', readNotification);
