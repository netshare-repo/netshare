import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/env.js';

export const protect = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (!token || !token.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_TOKEN', message: 'No token provided', requestId: req.requestId },
      });
    }

    token = token.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.secret);

    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found', requestId: req.requestId },
      });
    }

    if (req.user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_BLOCKED', message: 'User account is blocked', requestId: req.requestId },
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token', requestId: req.requestId },
    });
  }
};