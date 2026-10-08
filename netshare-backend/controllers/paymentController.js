import TopUpRequest from "../models/TopUpRequest.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import { createTopUp, createWithdrawal } from "../services/paymentService.js";

const fail = (res, error) => res.status(error.status || 500).json({
  message: error.status ? error.message : "Payment operation failed",
});

export const submitTopUp = async (req, res) => {
  try {
    const request = await createTopUp(req.user._id, req.body);
    const body = request.toObject();
    delete body.proofData;
    return res.status(201).json({ request: body });
  } catch (error) { return fail(res, error); }
};

export const myTopUps = async (req, res) => {
  try {
    const requests = await TopUpRequest.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100);
    return res.json({ requests });
  } catch (error) { return fail(res, error); }
};

export const submitWithdrawal = async (req, res) => {
  try {
    if (!["node_participant", "both"].includes(req.user.role)) {
      return res.status(403).json({ message: "Node participant role required" });
    }
    const request = await createWithdrawal(req.user._id, req.body);
    const body = request.toObject();
    delete body.accountDetails;
    return res.status(201).json({ request: body });
  } catch (error) { return fail(res, error); }
};

export const myWithdrawals = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100);
    return res.json({ requests });
  } catch (error) { return fail(res, error); }
};
