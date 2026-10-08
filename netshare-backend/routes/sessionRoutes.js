import express from "express";
import {
  getSessionById,
  getSessionByTaskId,
  startSession,
  completeSession,
} from "../controllers/sessionController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { developmentOnly } from '../middleware/productionGuard.js';

const router = express.Router();

router.get("/task/:taskId", protect, getSessionByTaskId);
router.get("/:id", protect, getSessionById);

router.put(
  "/:id/start",
  developmentOnly,
  protect,
  allowRoles("node_participant", "admin"),
  startSession
);

router.put(
  "/:id/complete",
  developmentOnly,
  protect,
  allowRoles("node_participant", "admin"),
  completeSession
);

export default router;
