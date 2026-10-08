import User from "../models/User.js";
import NodeDevice from "../models/NodeDevice.js";
import TestingTask from "../models/TestingTask.js";
import CreditTransaction from "../models/CreditTransaction.js";
import AdminLog from "../models/AdminLog.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalNodes = await NodeDevice.countDocuments();
    const activeNodes = await NodeDevice.countDocuments({
      status: { $in: ["active", "busy"] },
    });

    const totalTasks = await TestingTask.countDocuments();
    const activeTasks = await TestingTask.countDocuments({
      status: { $in: ["pending", "assigned", "running"] },
    });
    const completedTasks = await TestingTask.countDocuments({
      status: { $in: ['completed', 'settled'] },
    });

    const creditTransactions = await CreditTransaction.find({
      type: "credit",
    });

    const totalCreditsIssued = creditTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );

    return res.json({
      totalUsers,
      totalNodes,
      activeNodes,
      totalTasks,
      activeTasks,
      completedTasks,
      totalCreditsIssued,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch admin dashboard",
      error: error.message,
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { search, role, status, isVerified, page = 1, limit = 50 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    if (role) query.role = role;
    if (status) query.status = status;
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(query);

    return res.json({ users, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
};

export const getAllNodes = async (req, res) => {
  try {
    const { status, region, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (region) query.region = region;
    if (search) query.deviceName = { $regex: search, $options: "i" };

    const nodes = await NodeDevice.find(query)
      .populate("userId", "name email role")
      .sort({ createdAt: -1 });

    return res.json({ nodes });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch nodes", error: error.message });
  }
};

export const getAllTasks = async (req, res) => {
  try {
    const { status, serviceType, region } = req.query;
    const query = {};

    if (status) query.status = status;
    if (serviceType) query.serviceType = serviceType;
    if (region) query.targetRegion = region;

    const tasks = await TestingTask.find(query)
      .populate("clientId", "name email")
      .populate("assignedNodeId")
      .sort({ createdAt: -1 });

    return res.json({ tasks });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tasks", error: error.message });
  }
};

export const getAllTransactions = async (req, res) => {
  try {
    const { type, userId } = req.query;
    const query = {};

    if (type) query.type = type;
    if (userId) query.userId = userId;

    const transactions = await CreditTransaction.find(query)
      .populate("userId", "name email role")
      .populate("taskId")
      .sort({ createdAt: -1 });

    return res.json({ transactions });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch transactions", error: error.message });
  }
};

export const blockUser = async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: "Admin cannot block themselves" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = "blocked";
    await user.save();

    await AdminLog.create({
      adminId: req.user._id,
      action: "BLOCK_USER",
      details: `Admin blocked user ${user.email}`,
      targetType: "user",
      targetId: user._id,
    });

    return res.json({
      message: "User blocked successfully",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to block user",
      error: error.message,
    });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = "active";
    await user.save();

    await AdminLog.create({
      adminId: req.user._id,
      action: "UNBLOCK_USER",
      details: `Admin unblocked user ${user.email}`,
      targetType: "user",
      targetId: user._id,
    });

    return res.json({
      message: "User unblocked successfully",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to unblock user",
      error: error.message,
    });
  }
};

export const getAdminLogs = async (req, res) => {
  try {
    const logs = await AdminLog.find()
      .populate("adminId", "name email")
      .sort({ createdAt: -1 });

    return res.json({ logs });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch admin logs", error: error.message });
  }
};
