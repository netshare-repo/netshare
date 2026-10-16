import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sun, ArrowUpRight, CheckCircle2 } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import "./Register.css";

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleRequest = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    const trimmedEmail = email.trim();

    try {
      const res = await axiosInstance.post("/auth/forgot-password", { email: trimmedEmail });

      setSuccessMessage(res.data.message || "If that email address is in our database, we will send you an email to reset your password.");

      // After a brief moment, advance to OTP verification passing state
      setTimeout(() => {
        navigate("/verify-reset-otp", {
          state: {
            email: trimmedEmail,
            devOtp: res.data.devOtp,
          },
        });
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process password recovery request.");
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
                  stroke="url(#brandGradForgot)"
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
                  <linearGradient id="brandGradForgot" x1="2.5" y1="2" x2="21.5" y2="22" gradientUnits="userSpaceOnUse">
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
              <span>PASSWORD RECOVERY</span>
            </div>

            <h1 className="ps-card-title">Forgot your password?</h1>
            <p className="ps-card-subtitle">
              Enter your registered email or phone number. We will send you a 6-digit verification code to reset your password.
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

            <form className="ps-form" onSubmit={handleRequest}>
              <div className="ps-form-group">
                <label htmlFor="forgot-email">Email or Verified Number</label>
                <input
                  id="forgot-email"
                  type="text"
                  name="email"
                  autoComplete="username"
                  placeholder="name@company.com or +923001234567"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <button
                className="ps-submit-btn"
                type="submit"
                disabled={loading || !email.trim()}
              >
                {loading ? "Sending reset code..." : "Send Reset Code"}
              </button>

              <div className="ps-card-footer-links">
                <p className="ps-link-line">
                  <span className="ps-link-muted">Remembered your password? </span>
                  <Link to="/login" className="ps-link-action">
                    Back to Login &raquo;
                  </Link>
                </p>
                <p className="ps-link-line">
                  <span className="ps-link-muted">Need a new account? </span>
                  <Link to="/register" className="ps-link-action">
                    Sign up now &raquo;
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

export default ForgotPassword;
