import TopUpRequest from "../models/TopUpRequest.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import { reviewTopUp, reviewWithdrawal } from "../services/paymentService.js";

const fail = (res, error) => res.status(error.status || 500).json({
  message: error.status ? error.message : "Payment review failed",
});

const statusFilter = (value, allowed) => allowed.includes(value) ? value : "pending";

export const listTopUps = async (req, res) => {
  try {
    const requests = await TopUpRequest.find({ status: statusFilter(req.query.status, ["pending", "approved", "rejected"]) })
      .populate("userId", "name email").sort({ createdAt: -1 }).limit(100);
    return res.json({ requests });
  } catch (error) { return fail(res, error); }
};

export const listWithdrawals = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({ status: statusFilter(req.query.status,
      ["pending", "approved", "rejected", "processed"]) })
      .select("+accountDetails").populate("userId", "name email").sort({ createdAt: -1 }).limit(100);
    return res.json({ requests });
  } catch (error) { return fail(res, error); }
};

export const getTopUpProof = async (req, res) => {
  try {
    const request = await TopUpRequest.findById(req.params.id).select("+proofData");
    if (!request) return res.status(404).json({ message: "Top-up request not found" });
    res.set("Content-Type", request.proofMime);
    res.set("Content-Length", String(request.proofSize));
    res.set("Content-Disposition", `attachment; filename="topup-${request._id}.${request.proofMime === "application/pdf" ? "pdf" : request.proofMime === "image/png" ? "png" : "jpg"}"`);
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "no-store");
    return res.send(request.proofData);
  } catch (error) { return fail(res, error); }
};

export const decideTopUp = (decision) => async (req, res) => {
  try {
    const request = await reviewTopUp(req.params.id, req.user._id, decision, req.body?.adminNote);
    return res.json({ request });
  } catch (error) { return fail(res, error); }
};

export const decideWithdrawal = (decision) => async (req, res) => {
  try {
    const request = await reviewWithdrawal(req.params.id, req.user._id, decision, req.body?.adminNote);
    return res.json({ request });
  } catch (error) { return fail(res, error); }
};
