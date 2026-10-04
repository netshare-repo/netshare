export const allowRoles = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user.role;

    // Explicitly check if the user's role is in the allowed roles array.
    // If a route supports "both", it should be explicitly passed to allowRoles.
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        message: "Access denied. You are not allowed to access this route.",
      });
    }

    next();
  };
};