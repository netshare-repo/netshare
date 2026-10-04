import express from "express";
import {
  getWallet,
  getTransactions,
  addDemoCredit,
} from "../controllers/walletController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", protect, getWallet);
router.get("/transactions", protect, getTransactions);

router.post(
  "/demo-credit",
  protect,
  allowRoles("admin"),
  addDemoCredit
);

export default router;