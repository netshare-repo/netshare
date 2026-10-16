import express from "express";
import {
  getClientDashboard,
  getTaskCapabilities,
  createTask,
  getMyTasks,
  getTaskById,
  startTask,
  completeTask,
  failTask,
  estimateTaskCost,
  downloadTaskReport,
  rateTaskNode,
} from "../controllers/taskController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateTaskSubmission } from "../middleware/securityMiddleware.js";
import { developmentOnly } from '../middleware/productionGuard.js';
import config from '../config/env.js';
import {
  authorizeScreenshotUpload,
  uploadScreenshotArtifact,
  downloadScreenshotArtifact,
} from '../controllers/screenshotArtifactController.js';

const router = express.Router();

router.get(
  "/capabilities",
  protect,
  allowRoles("platform_client", "both"),
  getTaskCapabilities
);

router.get(
  "/client/dashboard",
  protect,
  allowRoles("platform_client", "both"),
  getClientDashboard
);

router.post(
  "/",
  protect,
  allowRoles("platform_client", "both"),
  validateTaskSubmission,
  createTask
);

router.post(
  "/estimate",
  protect,
  allowRoles("platform_client", "both"),
  estimateTaskCost
);

router.get(
  "/my-tasks",
  protect,
  allowRoles("platform_client", "both"),
  getMyTasks
);

router.get("/:id/report.csv", protect, downloadTaskReport);

router.post(
  '/:id/browser-artifacts/upload-grant',
  protect,
  allowRoles('node_participant', 'both'),
  authorizeScreenshotUpload,
);

router.put(
  '/:id/browser-artifacts/:artifactId',
  protect,
  allowRoles('node_participant', 'both'),
  express.raw({ type: 'image/png', limit: config.screenshotStorage.maxBytes }),
  uploadScreenshotArtifact,
);

router.get(
  '/:id/browser-artifacts/:artifactId',
  protect,
  downloadScreenshotArtifact,
);

router.post(
  "/:id/rating",
  protect,
  allowRoles("platform_client", "both"),
  rateTaskNode
);

router.get("/:id", protect, getTaskById);

router.put(
  "/:id/start",
  developmentOnly,
  protect,
  allowRoles("node_participant", "both", "admin"),
  startTask
);

router.put(
  "/:id/complete",
  developmentOnly,
  protect,
  allowRoles("node_participant", "both", "admin"),
  completeTask
);

router.put(
  "/:id/fail",
  developmentOnly,
  protect,
  allowRoles("node_participant", "both", "admin"),
  failTask
);

export default router;
