import config from '../config/env.js';

// Simulation endpoints are never part of the production execution/financial path.
export const developmentOnly = (req, res, next) => {
  if (config.isProduction) return res.status(410).json({ message: 'Legacy/demo endpoint disabled in production' });
  return next();
};
