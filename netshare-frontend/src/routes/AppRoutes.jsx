import { Routes, Route } from "react-router-dom";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import VerifySignupOtp from "../pages/auth/VerifySignupOtp";
import ForgotPassword from "../pages/auth/ForgotPassword";
import VerifyResetOtp from "../pages/auth/VerifyResetOtp";
import ResetPassword from "../pages/auth/ResetPassword";

import ClientDashboard from "../pages/client/ClientDashboard";
import SubmitTask from "../pages/client/SubmitTask";
import MyTasks from "../pages/client/MyTasks";
import ClientWallet from "../pages/client/ClientWallet";
import Marketplace from "../pages/client/Marketplace";
import MyOrders from "../pages/client/MyOrders";

import NodeDashboard from "../pages/node/NodeDashboard";
import NodeParticipation from "../pages/node/NodeParticipation";
import NodeSession from "../pages/node/NodeSession";
import NodeWallet from "../pages/node/NodeWallet";

import AdminDashboard from "../pages/admin/AdminDashboard";
import ManageUsers from "../pages/admin/ManageUsers";
import ManageNodes from "../pages/admin/ManageNodes";
import ManageTasks from "../pages/admin/ManageTasks";
import Transactions from "../pages/admin/Transactions";
import MarketplaceProducts from "../pages/admin/MarketplaceProducts";
import MarketplaceOrders from "../pages/admin/MarketplaceOrders";

import Profile from "../pages/common/Profile";

import ProtectedRoute from "../components/common/ProtectedRoute";
import RoleRoute from "../components/common/RoleRoute";

import LandingPage from "../pages/LandingPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-signup-otp" element={<VerifySignupOtp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-reset-otp" element={<VerifyResetOtp />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Node Participant Routes */}
      <Route
        path="/node/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["node_participant", "both", "admin"]}>
              <NodeDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/node/participation"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["node_participant", "both", "admin"]}>
              <NodeParticipation />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/node/session"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["node_participant", "both", "admin"]}>
              <NodeSession />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/node/wallet"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["node_participant", "both", "admin"]}>
              <NodeWallet />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Client & Both Routes */}
      <Route
        path="/client/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["platform_client", "both"]}>
              <ClientDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/client/submit-task"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["platform_client", "both"]}>
              <SubmitTask />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/client/tasks"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["platform_client", "both"]}>
              <MyTasks />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/client/wallet"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["platform_client", "both"]}>
              <ClientWallet />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/client/marketplace"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["platform_client", "both", "node_participant", "admin"]}>
              <Marketplace />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/client/orders"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["platform_client", "both", "node_participant", "admin"]}>
              <MyOrders />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/client/profile"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["platform_client", "both", "node_participant", "admin"]}>
              <Profile />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin"]}>
              <ManageUsers />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/nodes"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin"]}>
              <ManageNodes />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/tasks"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin"]}>
              <ManageTasks />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/transactions"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin"]}>
              <Transactions />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/marketplace/products"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin"]}>
              <MarketplaceProducts />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/marketplace/orders"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin"]}>
              <MarketplaceOrders />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/profile"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin"]}>
              <Profile />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default AppRoutes;