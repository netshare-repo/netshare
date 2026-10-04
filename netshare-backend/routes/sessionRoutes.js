import express from "express";
import {
  getSessionById,
  getSessionByTaskId,
  startSession,
  completeSession,
} from "../controllers/sessionController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/task/:taskId", protect, getSessionByTaskId);
router.get("/:id", protect, getSessionById);

router.put(
  "/:id/start",
  protect,
  allowRoles("node_participant", "admin"),
  startSession
);

router.put(
  "/:id/complete",
  protect,
  allowRoles("node_participant", "admin"),
  completeSession
);

export default router;