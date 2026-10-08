import TaskSession from "../models/TaskSession.js";

const canRead = (session, user) => user.role === 'admin' ||
  String(session.clientId?._id || session.clientId) === String(user._id) ||
  String(session.nodeId?.userId) === String(user._id);

export const getSessionById = async (req, res) => {
  try {
    const session = await TaskSession.findById(req.params.id)
      .select('-sessionToken')
      .populate("taskId")
      .populate("clientId", "name email")
      .populate("nodeId", "userId deviceName region status");

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!canRead(session, req.user)) return res.status(403).json({ message: 'Access denied' });
    return res.json({ session });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch session",
      error: error.message,
    });
  }
};

export const getSessionByTaskId = async (req, res) => {
  try {
    const session = await TaskSession.findOne({
      taskId: req.params.taskId,
    })
      .select('-sessionToken')
      .populate("taskId")
      .populate("nodeId", "userId deviceName region status");

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!canRead(session, req.user)) return res.status(403).json({ message: 'Access denied' });
    return res.json({ session });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch session",
      error: error.message,
    });
  }
};

export const startSession = async (req, res) => {
  try {
    const session = await TaskSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    session.status = "running";
    session.logs.push({
      message: "Task session started.",
    });

    await session.save();

    return res.json({
      message: "Session started successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to start session",
      error: error.message,
    });
  }
};

export const completeSession = async (req, res) => {
  try {
    const { bandwidthUsedMB, latencyMs } = req.body;

    const session = await TaskSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    session.status = "completed";
    session.bandwidthUsedMB = bandwidthUsedMB || 0;
    session.latencyMs = latencyMs || null;
    session.logs.push({
      message: "Task session completed.",
    });

    await session.save();

    return res.json({
      message: "Session completed successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to complete session",
      error: error.message,
    });
  }
};
