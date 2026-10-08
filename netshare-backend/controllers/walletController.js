import Wallet from "../models/Wallet.js";
import CreditTransaction from "../models/CreditTransaction.js";
import { addCredits } from "../services/walletService.js";
import { eligibleWithdrawalBalance } from "../services/paymentService.js";

export const getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    return res.json({ wallet, eligibleWithdrawalBalance: eligibleWithdrawalBalance(wallet) });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch wallet",
      error: error.message,
    });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    return res.json({ transactions });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch transactions",
      error: error.message,
    });
  }
};

export const addDemoCredit = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        message: "userId and amount are required",
      });
    }

    const wallet = await addCredits({
      userId,
      amount,
      description: "Demo credit added by admin",
    });

    return res.json({
      message: "Demo credits added successfully",
      wallet,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to add demo credits",
      error: error.message,
    });
  }
};
