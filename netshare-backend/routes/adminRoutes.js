import express from "express";
import {
  getAdminDashboard,
  getAllUsers,
  getAllNodes,
  getAllTasks,
  getAllTransactions,
  blockUser,
  unblockUser,
  getAdminLogs,
} from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { listTopUps, listWithdrawals, getTopUpProof, decideTopUp, decideWithdrawal } from "../controllers/adminPaymentController.js";

const router = express.Router();

router.get("/dashboard", protect, allowRoles("admin"), getAdminDashboard);
router.get("/users", protect, allowRoles("admin"), getAllUsers);
router.get("/nodes", protect, allowRoles("admin"), getAllNodes);
router.get("/tasks", protect, allowRoles("admin"), getAllTasks);
router.get("/transactions", protect, allowRoles("admin"), getAllTransactions);
router.put("/users/:id/block", protect, allowRoles("admin"), blockUser);
router.put("/users/:id/unblock", protect, allowRoles("admin"), unblockUser);
router.get("/logs", protect, allowRoles("admin"), getAdminLogs);
router.get("/payments/top-ups", protect, allowRoles("admin"), listTopUps);
router.get("/payments/top-ups/:id/proof", protect, allowRoles("admin"), getTopUpProof);
router.post("/payments/top-ups/:id/approve", protect, allowRoles("admin"), decideTopUp("approved"));
router.post("/payments/top-ups/:id/reject", protect, allowRoles("admin"), decideTopUp("rejected"));
router.get("/payments/withdrawals", protect, allowRoles("admin"), listWithdrawals);
router.post("/payments/withdrawals/:id/approve", protect, allowRoles("admin"), decideWithdrawal("approved"));
router.post("/payments/withdrawals/:id/reject", protect, allowRoles("admin"), decideWithdrawal("rejected"));
router.post("/payments/withdrawals/:id/process", protect, allowRoles("admin"), decideWithdrawal("processed"));

export default router;
