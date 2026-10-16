import { useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Send,
  ListChecks,
  FileBarChart,
  Activity,
  Wallet,
  Store,
  ReceiptText,
  ShieldAlert,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Plus,
} from "lucide-react";
import { useAuth } from "../context/authState";
import axiosInstance from "../api/axiosInstance";
import NotificationBell from "../components/common/NotificationBell";
import "./ClientLayout.css";

function ClientLayout({
  children,
  pageTitle = "Overview",
  pageSubtitle = "Platform Client Control Panel",
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search tasks, regions or URLs...",
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);

  const profileRef = useRef(null);

  // Fetch quick wallet balance for topbar
  useEffect(() => {
    let isMounted = true;
    axiosInstance
      .get("/wallet")
      .then((res) => {
        if (isMounted && res.data?.wallet) {
          setWalletBalance(res.data.wallet.balance);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  // Close mobile sidebar and dropdown on navigation
  useEffect(() => {
    const timer = setTimeout(() => {
      setMobileSidebarOpen(false);
      setProfileDropdownOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Click outside to close profile dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") setProfileDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleLabel =
    user?.role === "both"
      ? "Client & Node"
      : user?.role === "platform_client"
      ? "Platform Client"
      : user?.role || "Client";

  return (
    <div className="client-layout-root">
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="client-mobile-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`client-sidebar-container ${
          mobileSidebarOpen ? "mobile-open" : ""
        }`}
      >
        <div className="client-sidebar-header">
          <Link to="/client/dashboard" className="client-brand-link">
            <div className="client-brand-logo">
              <span className="client-brand-glyph" />
            </div>
            <div className="client-brand-info">
              <span className="client-brand-name">NetShare</span>
              <span className="client-brand-badge">CLIENT</span>
            </div>
          </Link>

          <button
            type="button"
            className="client-mobile-close-btn"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="client-sidebar-nav">
          <div className="client-nav-group-label">Core Operations</div>

          <NavLink
            to="/client/dashboard"
            end
            className={({ isActive }) =>
              `client-nav-item ${isActive ? "active" : ""}`
            }
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </NavLink>

          <NavLink
            to="/client/submit-task"
            className={({ isActive }) =>
              `client-nav-item ${isActive ? "active" : ""}`
            }
          >
            <Send size={18} />
            <span>Submit Task</span>
          </NavLink>

          <NavLink
            to="/client/tasks"
            className={({ isActive }) =>
              `client-nav-item ${isActive ? "active" : ""}`
            }
          >
            <ListChecks size={18} />
            <span>My Tasks</span>
          </NavLink>

          <NavLink
            to="/client/tasks?tab=completed"
            className={({ isActive }) =>
              `client-nav-item ${
                isActive && location.search.includes("completed")
                  ? "active"
                  : ""
              }`
            }
          >
            <FileBarChart size={18} />
            <span>Task Results</span>
          </NavLink>

          <NavLink
            to="/client/network-availability"
            className={({ isActive }) =>
              `client-nav-item ${isActive ? "active" : ""}`
            }
          >
            <Activity size={18} />
            <span>Network Availability</span>
          </NavLink>

          <div className="client-nav-group-label">Finance & Services</div>

          <NavLink
            to="/client/wallet"
            className={({ isActive }) =>
              `client-nav-item ${isActive ? "active" : ""}`
            }
          >
            <Wallet size={18} />
            <span>Wallet & Billing</span>
          </NavLink>

          <NavLink
            to="/client/marketplace"
            className={({ isActive }) =>
              `client-nav-item ${isActive ? "active" : ""}`
            }
          >
            <Store size={18} />
            <span>Marketplace</span>
          </NavLink>

          <NavLink
            to="/client/orders"
            className={({ isActive }) =>
              `client-nav-item ${isActive ? "active" : ""}`
            }
          >
            <ReceiptText size={18} />
            <span>My Orders</span>
          </NavLink>

          <NavLink
            to="/disputes"
            className={({ isActive }) =>
              `client-nav-item ${isActive ? "active" : ""}`
            }
          >
            <ShieldAlert size={18} />
            <span>Disputes</span>
          </NavLink>

          <div className="client-nav-group-label">Account</div>

          <NavLink
            to="/client/profile"
            className={({ isActive }) =>
              `client-nav-item ${isActive ? "active" : ""}`
            }
          >
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer Card */}
        <div className="client-sidebar-footer">
          <div className="client-network-pulse-card">
            <div className="client-pulse-dot-wrap">
              <span className="client-pulse-dot" />
              <span className="client-pulse-ring" />
            </div>
            <div className="client-pulse-text">
              <strong>Decentralized Mesh</strong>
              <small>Zero-knowledge routing active</small>
            </div>
          </div>

          <button
            type="button"
            className="client-sidebar-logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="client-main-wrapper">
        {/* Topbar */}
        <header className="client-topbar-container">
          <div className="client-topbar-left">
            <button
              type="button"
              className="client-hamburger-btn"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={22} />
            </button>

            <div className="client-header-title-box">
              <span className="client-header-breadcrumb">{pageSubtitle}</span>
              <h1 className="client-header-title">{pageTitle}</h1>
            </div>
          </div>

          {/* Search bar (functional when props provided) */}
          {typeof onSearchChange === "function" && (
            <div className="client-topbar-search">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                className="client-search-input"
              />
            </div>
          )}

          <div className="client-topbar-right">
            {/* Quick Action Button */}
            <Link to="/client/submit-task" className="client-topbar-cta">
              <Plus size={15} />
              <span>Submit Task</span>
            </Link>

            {/* Wallet Balance Pill */}
            <Link
              to="/client/wallet"
              className="client-wallet-pill"
              title="View wallet & transactions"
            >
              <div className="client-wallet-pill-icon">
                <Wallet size={15} />
              </div>
              <div className="client-wallet-pill-body">
                <span className="client-wallet-pill-val">
                  {walletBalance !== null ? walletBalance : "--"}
                </span>
                <span className="client-wallet-pill-unit">credits</span>
              </div>
            </Link>

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Profile Dropdown */}
            <div className="client-profile-dropdown-wrapper" ref={profileRef}>
              <button
                type="button"
                className={`client-profile-trigger ${
                  profileDropdownOpen ? "active" : ""
                }`}
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                aria-expanded={profileDropdownOpen}
                aria-label="User profile menu"
              >
                <div className="client-user-avatar">
                  {user?.name?.charAt(0)?.toUpperCase() || "C"}
                </div>
                <div className="client-user-meta">
                  <span className="client-user-name">
                    {user?.name || "Client"}
                  </span>
                  <span className="client-user-role">{roleLabel}</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`client-chevron ${
                    profileDropdownOpen ? "rotate" : ""
                  }`}
                />
              </button>

              {profileDropdownOpen && (
                <div className="client-profile-menu" role="menu" aria-label="Account menu">
                  <div className="client-profile-menu-header">
                    <div className="client-menu-avatar" aria-hidden="true">
                      {user?.name?.charAt(0)?.toUpperCase() || "C"}
                    </div>
                    <div className="client-menu-identity">
                      <p className="client-menu-user-name">{user?.name || "Client"}</p>
                      <p className="client-menu-user-email">{user?.email || ""}</p>
                      <span className="client-menu-role-tag">{roleLabel}</span>
                    </div>
                  </div>

                  <div className="client-profile-menu-links">
                    <Link
                      to="/client/profile"
                      className="client-menu-link"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <User size={15} />
                      <span>Account Settings</span>
                    </Link>

                    <Link
                      to="/client/wallet"
                      className="client-menu-link"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Wallet size={15} />
                      <span>Wallet & Credits</span>
                    </Link>

                    <Link
                      to="/client/tasks"
                      className="client-menu-link"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <ListChecks size={15} />
                      <span>My Testing Tasks</span>
                    </Link>
                  </div>

                  <div className="client-profile-menu-footer">
                    <button
                      type="button"
                      className="client-menu-logout-btn"
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Section */}
        <main className="client-layout-content">{children}</main>
      </div>
    </div>
  );
}

export default ClientLayout;
