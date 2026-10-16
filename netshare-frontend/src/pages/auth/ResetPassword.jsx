import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Sun, ArrowUpRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import "./Register.css";

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const email = location.state?.email || "";
  const otp = location.state?.otp || "";

  // Guard: if no email or otp in state, redirect to forgot-password
  useEffect(() => {
    if (!email || !otp) {
      navigate("/forgot-password", { replace: true });
    }
  }, [email, otp, navigate]);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Z]/.test(form.newPassword) || !/[a-z]/.test(form.newPassword) || !/\d/.test(form.newPassword)) {
      setError("Password must contain at least one uppercase letter, one lowercase letter, and one number.");
      return;
    }

    setLoading(true);

    try {
      const res = await axiosInstance.post("/auth/reset-password", {
        email,
        otp,
        newPassword: form.newPassword,
      });

      setSuccessMessage(res.data.message || "Password reset successfully! Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password. Please request a new code.");
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
                  stroke="url(#brandGradResetPass)"
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
                  <linearGradient id="brandGradResetPass" x1="2.5" y1="2" x2="21.5" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#28c3d4" />
                    <stop offset="1" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <span className="ps-brand-name">NetShare</span>
          </Link>

          <Link to="/login" className="ps-nav-link">
            <Sun size={14} className="ps-nav-sun" />
            <span>Back to Login</span>
            <ArrowUpRight size={13} className="ps-nav-arrow" />
          </Link>
        </div>
      </header>

      {/* Main Centered View */}
      <main className="ps-main-container">
        <div className="ps-otp-wrapper">
          <div className="ps-card ps-otp-card">
            <div className="ps-eyebrow">
              <span className="ps-eyebrow-dot" />
              <span>NEW CREDENTIALS</span>
            </div>

            <h1 className="ps-card-title">Set new password.</h1>
            <p className="ps-card-subtitle">
              Create a secure password for <strong className="ps-target-email">{email}</strong>
            </p>

            {error && (
              <div className="ps-alert-error" role="alert">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="ps-alert-success" role="status">
                <CheckCircle2 size={16} />
                <span>{successMessage}</span>
              </div>
            )}

            <form className="ps-form" onSubmit={handleReset}>
              <div className="ps-form-group">
                <label htmlFor="reset-new-password">New Password</label>
                <div className="ps-password-input-wrapper">
                  <input
                    id="reset-new-password"
                    type={showPassword ? "text" : "password"}
                    name="newPassword"
                    autoComplete="new-password"
                    placeholder="Min 8 chars, 1 uppercase, 1 num"
                    value={form.newPassword}
                    onChange={handleChange}
                    required
                    disabled={loading || !!successMessage}
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
                <label htmlFor="reset-confirm-password">Confirm New Password</label>
                <div className="ps-password-input-wrapper">
                  <input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                    disabled={loading || !!successMessage}
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

              <p className="ps-password-hint">
                Must be at least 8 characters with 1 uppercase letter, 1 lowercase letter, and 1 number.
              </p>

              <button
                className="ps-submit-btn"
                type="submit"
                disabled={loading || !!successMessage}
              >
                {loading ? "Resetting password..." : "Reset Password"}
              </button>

              <div className="ps-card-footer-links">
                <p className="ps-link-line">
                  <Link to="/login" className="ps-link-action">
                    Back to Login &raquo;
                  </Link>
                </p>
              </div>
            </form>
          </div>
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

export default ResetPassword;
