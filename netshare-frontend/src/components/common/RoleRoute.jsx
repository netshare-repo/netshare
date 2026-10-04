import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/login" />;
  }

  return children;
}

export default RoleRoute;