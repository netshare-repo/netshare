import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Send,
  ListChecks,
  Wallet,
  LogOut,
  Network,
  Bell,
  Store,
  ReceiptText,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./ClientLayout.css";

function ClientLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="client-layout">
      <aside className="client-sidebar">
        <div className="client-logo">
          <div className="client-logo-icon">
            <Network size={24} />
          </div>
          <div>
            <h2>NetShare</h2>
            <p>Client Panel</p>
          </div>
        </div>

        <nav className="client-nav">
          <NavLink to="/client/dashboard">
            <LayoutDashboard size={19} />
            Dashboard
          </NavLink>

          <NavLink to="/client/submit-task">
            <Send size={19} />
            Submit Task
          </NavLink>

          <NavLink to="/client/tasks">
            <ListChecks size={19} />
            My Tasks
          </NavLink>

          <NavLink to="/client/wallet">
            <Wallet size={19} />
            Wallet
          </NavLink>

          <NavLink to="/client/marketplace">
            <Store size={19} />
            Marketplace
          </NavLink>

          <NavLink to="/client/orders">
            <ReceiptText size={19} />
            My Orders
          </NavLink>
        </nav>

        <div className="client-sidebar-card">
          <h4>Credit Marketplace</h4>
          <p>Redeem earned or available credits for digital services.</p>
        </div>

        <button className="client-logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <main className="client-main">
        <header className="client-topbar">
          <div>
            <h3>Welcome back, {user?.name || "Client"}</h3>
            <p>Manage testing tasks, credits, marketplace, and results.</p>
          </div>

          <div className="client-topbar-right">
            <button className="client-bell">
              <Bell size={19} />
            </button>

            <div className="client-user-pill">
              <div className="client-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || "C"}
              </div>
              <div>
                <h5>{user?.name}</h5>
                <span>{user?.role}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="client-content">{children}</section>
      </main>
    </div>
  );
}

export default ClientLayout;