import express from "express";
import {
  registerNode,
  getNodeDashboard,
  getMyNode,
  updateNodeSettings,
  startParticipation,
  stopParticipation,
  getCurrentSession,
  getNodeTransactions,
  getAssignedTask,
  getNodeApiKey,
  regenerateNodeApiKey,
  getNodeTelemetryHistory,
  getNodeHeartbeats,
  getNodeBandwidthHistory,
  pauseParticipation,
  resumeParticipation,
  getAvailableRegions,
} from "../controllers/nodeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

const allowedNodeRoles = ["node_participant", "both", "admin"];

router.get(
  "/availability",
  protect,
  allowRoles("platform_client", "both", "admin"),
  getAvailableRegions
);

// Node Dashboard
router.get(
  "/dashboard",
  protect,
  allowRoles(...allowedNodeRoles),
  getNodeDashboard
);

// Registration & Profile
router.post(
  "/register",
  protect,
  allowRoles(...allowedNodeRoles),
  registerNode
);

router.get(
  "/my-node",
  protect,
  allowRoles(...allowedNodeRoles),
  getMyNode
);

// Settings
router.put(
  "/settings",
  protect,
  allowRoles(...allowedNodeRoles),
  updateNodeSettings
);

// Session Control (Supports both POST and PUT for compatibility)
router.post(
  "/start",
  protect,
  allowRoles(...allowedNodeRoles),
  startParticipation
);

router.put(
  "/start",
  protect,
  allowRoles(...allowedNodeRoles),
  startParticipation
);

router.post(
  "/stop",
  protect,
  allowRoles(...allowedNodeRoles),
  stopParticipation
);

router.put(
  "/stop",
  protect,
  allowRoles(...allowedNodeRoles),
  stopParticipation
);

router.put('/pause', protect, pauseParticipation);
router.put('/resume', protect, resumeParticipation);

// Live Session Monitoring
router.get(
  "/session/current",
  protect,
  allowRoles(...allowedNodeRoles),
  getCurrentSession
);

// Earnings & Transactions
router.get(
  "/transactions",
  protect,
  allowRoles(...allowedNodeRoles),
  getNodeTransactions
);

// Assigned Tasks
router.get(
  "/assigned-task",
  protect,
  allowRoles(...allowedNodeRoles),
  getAssignedTask
);

// Node API Key Management for Headless Daemon / Agent
router.get(
  "/api-key",
  protect,
  allowRoles(...allowedNodeRoles),
  getNodeApiKey
);

router.post(
  "/api-key/regenerate",
  protect,
  allowRoles(...allowedNodeRoles),
  regenerateNodeApiKey
);

// Historical Telemetry and Health Metrics
router.get(
  "/telemetry",
  protect,
  allowRoles(...allowedNodeRoles),
  getNodeTelemetryHistory
);

router.get(
  "/heartbeats",
  protect,
  allowRoles(...allowedNodeRoles),
  getNodeHeartbeats
);

router.get(
  "/bandwidth-usage",
  protect,
  allowRoles(...allowedNodeRoles),
  getNodeBandwidthHistory
);

export default router;
