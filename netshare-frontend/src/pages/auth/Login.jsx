import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sun, Eye, EyeOff, ArrowUpRight } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../../context/authState";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axiosInstance.post("/auth/login", form);

      login(res.data.token, res.data.user);

      if (res.data.user.role === "admin") {
        navigate("/admin/dashboard");
      } else if (res.data.user.role === "node_participant") {
        navigate("/node/dashboard");
      } else if (
        res.data.user.role === "platform_client" ||
        res.data.user.role === "both"
      ) {
        navigate("/client/dashboard");
      } else {
        navigate("/node/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ps-login-page">
      {/* Top Header */}
      <header className="ps-header">
        <div className="ps-header-inner">
          <Link to="/" className="ps-brand">
            <span className="ps-brand-mark" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z"
                  stroke="url(#brandGrad)"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3.2" fill="#28c3d4" />
                <path
                  d="M12 8.8V4M12 15.2V20M8.8 13.8L5 16M15.2 10.2L19 8"
                  stroke="#28c3d4"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="brandGrad" x1="2.5" y1="2" x2="21.5" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#28c3d4" />
                    <stop offset="1" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <span className="ps-brand-name">NetShare</span>
          </Link>

          <Link to="/" className="ps-nav-link">
            <Sun size={14} className="ps-nav-sun" />
            <span>Back to netshare.io</span>
            <ArrowUpRight size={13} className="ps-nav-arrow" />
          </Link>
        </div>
      </header>

      {/* Main Two-Column View */}
      <main className="ps-main-container">
        <div className="ps-content-grid">
          {/* Left Column: Hero Section */}
          <section className="ps-hero-section">
            <div className="ps-eyebrow">
              <span className="ps-eyebrow-dot" />
              <span>DISTRIBUTED NETWORK INTELLIGENCE</span>
            </div>

            <h1 className="ps-hero-headline">
              One network.
              <br />
              <span className="ps-hero-italic">Every perspective.</span>
            </h1>

            <p className="ps-hero-description">
              Access real regional network testing, manage participating devices,
              <br className="ps-desc-break" />
              and track results from one secure workspace.
            </p>

            <ul className="ps-feature-list">
              <li className="ps-feature-item">
                <span className="ps-feature-dot ps-dot-cyan" />
                <span>Real regional website testing</span>
              </li>
              <li className="ps-feature-item">
                <span className="ps-feature-dot ps-dot-purple" />
                <span>Secure distributed node network</span>
              </li>
              <li className="ps-feature-item">
                <span className="ps-feature-dot ps-dot-green" />
                <span>Transparent usage and rewards</span>
              </li>
            </ul>
          </section>

          {/* Right Column: Login Card */}
          <section className="ps-card-section">
            <div className="ps-card">
              <h2 className="ps-card-title">Welcome back.</h2>
              <p className="ps-card-subtitle">
                Login to NetShare to manage your account.
              </p>

              {error && (
                <div className="ps-alert-error" role="alert">
                  {error}
                </div>
              )}

              <form className="ps-form" onSubmit={handleLogin}>
                <div className="ps-form-group">
                  <label htmlFor="ps-email">Username</label>
                  <input
                    id="ps-email"
                    type="text"
                    name="email"
                    autoComplete="username"
                    placeholder="Enter email or mobile number"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="ps-form-group">
                  <label htmlFor="ps-password">Password</label>
                  <div className="ps-password-input-wrapper">
                    <input
                      id="ps-password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      placeholder="Enter password"
                      value={form.password}
                      onChange={handleChange}
                      required
                    />
                    <button
                      type="button"
                      className="ps-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  className="ps-submit-btn"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Log in"}
                </button>

                <div className="ps-card-footer-links">
                  <p className="ps-link-line">
                    <span className="ps-link-muted">New to NetShare? </span>
                    <Link to="/register" className="ps-link-action">
                      Sign up now &raquo;
                    </Link>
                  </p>
                  <p className="ps-link-line">
                    <span className="ps-link-muted">Forgot your password? </span>
                    <Link to="/forgot-password" className="ps-link-action">
                      Reset your password &raquo;
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="ps-footer">
        <div className="ps-footer-inner">
          <span className="ps-footer-copy">© 2026 NetShare Inc.</span>
          <nav className="ps-footer-nav" aria-label="Footer links">
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default Login;
