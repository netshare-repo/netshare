import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Server,
  ListChecks,
  Wallet,
  Store,
  PackageCheck,
  LogOut,
  Network,
} from "lucide-react";
import { useAuth } from "../context/authState";
import NotificationBell from '../components/common/NotificationBell';
import "./AdminLayout.css";

function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-icon">
            <Network size={25} />
          </div>

          <div>
            <h2>NetShare</h2>
            <p>Admin Panel</p>
          </div>
        </div>

        <nav className="admin-nav">
          <NavLink to="/admin/operations"><ListChecks size={20} /> Alerts / Reports / Disputes</NavLink>
          <NavLink to="/admin/dashboard">
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>

          <NavLink to="/admin/users">
            <Users size={20} />
            Users
          </NavLink>

          <NavLink to="/admin/nodes">
            <Server size={20} />
            Nodes
          </NavLink>

          <NavLink to="/admin/tasks">
            <ListChecks size={20} />
            Tasks
          </NavLink>

          <NavLink to="/admin/transactions">
            <Wallet size={20} />
            Transactions
          </NavLink>

          <NavLink to="/admin/payments">
            <Wallet size={20} />
            Payments
          </NavLink>

          <NavLink to="/admin/marketplace/products">
            <Store size={20} />
            Products
          </NavLink>

          <NavLink to="/admin/marketplace/orders">
            <PackageCheck size={20} />
            Orders
          </NavLink>
        </nav>

        <div className="admin-sidebar-card">
          <h4>Admin Control</h4>
          <p>Monitor users, nodes, tasks, credits, and marketplace orders.</p>
        </div>

        <button className="admin-logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h3>Admin Dashboard</h3>
            <p>Monitor users, nodes, tasks, credits, and marketplace.</p>
          </div>

          <div className="admin-topbar-right">
            <NotificationBell />

            <div className="admin-user-pill">
              <div className="admin-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || "A"}
              </div>

              <div>
                <h5>{user?.name || "Admin"}</h5>
                <span>{user?.role || "admin"}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="admin-content">{children}</section>
      </main>
    </div>
  );
}

export default AdminLayout;
