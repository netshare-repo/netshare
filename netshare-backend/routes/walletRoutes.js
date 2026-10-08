import express from "express";
import {
  getWallet,
  getTransactions,
  addDemoCredit,
} from "../controllers/walletController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { developmentOnly } from '../middleware/productionGuard.js';
import { submitTopUp, myTopUps, submitWithdrawal, myWithdrawals } from "../controllers/paymentController.js";

const router = express.Router();

router.get("/", protect, getWallet);
router.get("/transactions", protect, getTransactions);
router.get("/top-ups", protect, myTopUps);
router.post("/top-ups", protect, submitTopUp);
router.get("/withdrawals", protect, myWithdrawals);
router.post("/withdrawals", protect, allowRoles("node_participant", "both"), submitWithdrawal);

router.post(
  "/demo-credit",
  developmentOnly,
  protect,
  allowRoles("admin"),
  addDemoCredit
);

export default router;
