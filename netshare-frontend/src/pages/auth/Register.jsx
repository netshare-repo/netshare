import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sun, Eye, EyeOff, ArrowUpRight, Check } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../../context/authState";
import "./Register.css";

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "platform_client",
    verificationMethod: "email",
    termsAccepted: false,
  });

  const handleChange = (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({
      ...prev,
      [e.target.name]: value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
      setError("Password must contain at least one uppercase letter, one lowercase letter, and one number.");
      return;
    }

    if (!form.termsAccepted) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: form.role,
        verificationMethod: form.verificationMethod,
      };

      const res = await axiosInstance.post("/auth/register", payload);

      // In local development bypass mode, token and user are returned immediately
      if (res.data.token && res.data.user) {
        login(res.data.token, res.data.user);
        if (res.data.user.role === "admin") {
          navigate("/admin/dashboard");
        } else if (res.data.user.role === "node_participant") {
          navigate("/node/dashboard");
        } else {
          navigate("/client/dashboard");
        }
        return;
      }

      // Redirect to OTP verification page
      navigate("/verify-signup-otp", {
        state: {
          email: res.data.identifier || form.email.trim(),
          verificationMethod: form.verificationMethod,
          devOtp: res.data.devOtp,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ps-auth-page">
      {/* Top Header */}
      <header className="ps-header">
        <div className="ps-header-inner">
          <Link to="/" className="ps-brand">
            <span className="ps-brand-mark" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z"
                  stroke="url(#brandGradReg)"
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
                  <linearGradient id="brandGradReg" x1="2.5" y1="2" x2="21.5" y2="22" gradientUnits="userSpaceOnUse">
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
        <div className="ps-content-grid ps-register-grid">
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
              Create your account to run targeted regional network requests,
              <br className="ps-desc-break" />
              share bandwidth nodes, and track verified results.
            </p>

            <ul className="ps-feature-list">
              <li className="ps-feature-item">
                <span className="ps-feature-dot ps-dot-cyan" />
                <span>Verified client & node workspaces</span>
              </li>
              <li className="ps-feature-item">
                <span className="ps-feature-dot ps-dot-purple" />
                <span>Real-time regional network telemetry</span>
              </li>
              <li className="ps-feature-item">
                <span className="ps-feature-dot ps-dot-green" />
                <span>Automated transparent accounting & rewards</span>
              </li>
            </ul>
          </section>

          {/* Right Column: Register Card */}
          <section className="ps-card-section">
            <div className="ps-card ps-register-card">
              <h2 className="ps-card-title">Create account.</h2>
              <p className="ps-card-subtitle">
                Start using NetShare to run tests or share network bandwidth.
              </p>

              {error && (
                <div className="ps-alert-error" role="alert">
                  {error}
                </div>
              )}

              <form className="ps-form ps-register-form" onSubmit={handleRegister}>
                <div className="ps-form-row">
                  <div className="ps-form-group">
                    <label htmlFor="reg-name">Full Name</label>
                    <input
                      id="reg-name"
                      type="text"
                      name="name"
                      autoComplete="name"
                      placeholder="Enter full name"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="ps-form-group">
                    <label htmlFor="reg-email">Email Address</label>
                    <input
                      id="reg-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="name@company.com"
                      value={form.email}
                      onChange={handleChange}
                      required={form.verificationMethod === "email"}
                    />
                  </div>
                </div>

                <div className="ps-form-row">
                  <div className="ps-form-group">
                    <label htmlFor="reg-phone">
                      Phone Number <span className="ps-label-hint">(optional)</span>
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      placeholder="+923001234567"
                      value={form.phone}
                      onChange={handleChange}
                      required={form.verificationMethod === "sms"}
                    />
                  </div>

                  <div className="ps-form-group">
                    <label htmlFor="reg-role">Account Role</label>
                    <div className="ps-select-wrapper">
                      <select
                        id="reg-role"
                        name="role"
                        value={form.role}
                        onChange={handleChange}
                      >
                        <option value="platform_client">Client (Request tasks)</option>
                        <option value="node_participant">Node (Share bandwidth)</option>
                        <option value="both">Both (Client & Node)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="ps-form-row">
                  <div className="ps-form-group">
                    <label htmlFor="reg-password">Password</label>
                    <div className="ps-password-input-wrapper">
                      <input
                        id="reg-password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        autoComplete="new-password"
                        placeholder="Min 8 chars, 1 uppercase, 1 num"
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
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="ps-form-group">
                    <label htmlFor="reg-confirm-password">Confirm Password</label>
                    <div className="ps-password-input-wrapper">
                      <input
                        id="reg-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        required
                      />
                      <button
                        type="button"
                        className="ps-password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="ps-form-checkbox-group">
                  <label className="ps-checkbox-label">
                    <input
                      type="checkbox"
                      name="termsAccepted"
                      checked={form.termsAccepted}
                      onChange={handleChange}
                      required
                    />
                    <span className="ps-checkbox-custom">
                      {form.termsAccepted && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="ps-checkbox-text">
                      I agree to the <a href="#terms">Terms of Service</a> and{" "}
                      <a href="#privacy">Privacy Policy</a>
                    </span>
                  </label>
                </div>

                <button
                  className="ps-submit-btn"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Create account"}
                </button>

                <div className="ps-card-footer-links">
                  <p className="ps-link-line">
                    <span className="ps-link-muted">Already have an account? </span>
                    <Link to="/login" className="ps-link-action">
                      Log in &raquo;
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

export default Register;
