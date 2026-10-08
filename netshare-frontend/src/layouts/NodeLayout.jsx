import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Activity,
  Radio,
  Wallet,
  Store,
  LogOut,
  Network,
  Cpu,
} from "lucide-react";
import { useAuth } from "../context/authState";
import NotificationBell from '../components/common/NotificationBell';
import { getNodeDashboard } from "../api/nodeApi";
import StatusBadge from "../components/common/StatusBadge";
import "./NodeLayout.css";

function NodeLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [nodeStatus, setNodeStatus] = useState("inactive");
  const [deviceName, setDeviceName] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const data = await getNodeDashboard();
        if (isMounted && data) {
          setNodeStatus(data.status || "inactive");
          if (data.device?.deviceName) {
            setDeviceName(data.device.deviceName);
          }
        }
      } catch {
        // Node may not be registered yet
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="node-layout">
      <aside className="node-sidebar">
        <div className="node-logo">
          <div className="node-logo-icon">
            <Cpu size={24} />
          </div>
          <div>
            <h2>NetShare</h2>
            <p>Node Participant</p>
          </div>
        </div>

        <nav className="node-nav">
          <NavLink to="/disputes"><Activity size={19} /> Disputes</NavLink>
          <NavLink
            to="/node/dashboard"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <LayoutDashboard size={19} />
            Dashboard
          </NavLink>

          <NavLink
            to="/node/participation"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Activity size={19} />
            Participation
          </NavLink>

          <NavLink
            to="/node/session"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Radio size={19} />
            Live Session
          </NavLink>

          <NavLink
            to="/node/wallet"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Wallet size={19} />
            Earnings & Wallet
          </NavLink>

          <NavLink
            to="/client/marketplace"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Store size={19} />
            Marketplace
          </NavLink>
        </nav>

        <div className="node-sidebar-card">
          <div className="sidebar-card-badge">Live Node</div>
          <h4>Bandwidth Sharing</h4>
          <p>Earn credits automatically by contributing bandwidth to testing tasks.</p>
        </div>

        <button className="node-logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <main className="node-main">
        <header className="node-topbar">
          <div className="node-topbar-left">
            <h3>Welcome, {user?.name || "Participant"}</h3>
            <p>Monetize unused bandwidth through controlled, secure web testing.</p>
          </div>

          <div className="node-topbar-right">
            <NotificationBell />
            <div className="node-status-indicator">
              <span className="node-device-name">
                <Network size={15} />
                {deviceName || "Desktop Node"}
              </span>
              <StatusBadge status={nodeStatus} />
            </div>

            <div className="node-user-pill">
              <div className="node-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || "N"}
              </div>
              <div className="node-user-info">
                <h5>{user?.name}</h5>
                <span>{user?.role?.replace("_", " ")}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="node-content">{children}</section>
      </main>
    </div>
  );
}

export default NodeLayout;
