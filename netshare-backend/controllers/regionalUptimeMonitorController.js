import mongoose from 'mongoose';
import {
  createRegionalUptimeMonitor, listRegionalUptimeMonitors,
  getRegionalUptimeMonitor, cancelRegionalUptimeMonitor,
} from '../services/regionalUptimeMonitorService.js';

const sendError = (res, error) => res.status(error.status || 500).json({
  message: error.status ? error.message : 'Regional uptime monitor request failed',
});
const validId = value => mongoose.isValidObjectId(value);

export const createMonitor = async (req, res) => {
  try {
    const idempotencyKey = req.get?.('Idempotency-Key') || req.headers?.['idempotency-key'];
    const result = await createRegionalUptimeMonitor({ clientId: req.user._id, input: req.body, idempotencyKey });
    return res.status(201).json({ serviceType: 'REGIONAL_UPTIME_MONITOR', ...result });
  } catch (error) { return sendError(res, error); }
};

export const listMonitors = async (req, res) => {
  try {
    const monitors = await listRegionalUptimeMonitors({ clientId: req.user._id, limit: req.query.limit });
    return res.json({ serviceType: 'REGIONAL_UPTIME_MONITOR', monitors });
  } catch (error) { return sendError(res, error); }
};

export const getMonitor = async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Monitor not found' });
  try {
    const result = await getRegionalUptimeMonitor({ monitorId: req.params.id,
      clientId: req.user._id, historyLimit: req.query.limit });
    return result ? res.json(result) : res.status(404).json({ message: 'Monitor not found' });
  } catch (error) { return sendError(res, error); }
};

export const cancelMonitor = async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Monitor not found' });
  try {
    const result = await cancelRegionalUptimeMonitor({ monitorId: req.params.id, clientId: req.user._id });
    return result ? res.json(result) : res.status(404).json({ message: 'Monitor not found' });
  } catch (error) { return sendError(res, error); }
};
