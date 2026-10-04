import TaskSession from "../models/TaskSession.js";

export const getSessionById = async (req, res) => {
  try {
    const session = await TaskSession.findById(req.params.id)
      .populate("taskId")
      .populate("clientId", "name email")
      .populate("nodeId");

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

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
      .populate("taskId")
      .populate("nodeId");

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

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