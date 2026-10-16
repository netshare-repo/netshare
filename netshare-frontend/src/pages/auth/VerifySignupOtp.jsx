import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Sun, ArrowUpRight, CheckCircle2, RotateCw } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../../context/authState";
import "./Register.css";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

function VerifySignupOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // In development mode, devOtp might be provided by backend for testing
  const [devOtp, setDevOtp] = useState(() => (import.meta.env.DEV ? location.state?.devOtp : undefined));

  const inputRefs = useRef([]);
  const email = location.state?.email || "";

  // Guard: if no email in state, redirect back to register
  useEffect(() => {
    if (!email) {
      navigate("/register", { replace: true });
    }
  }, [email, navigate]);

  // Focus the first input on load
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleDigitChange = (index, value) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setError("");

    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (digits[index] === "" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pastedText) return;

    const newDigits = [...digits];
    for (let i = 0; i < OTP_LENGTH; i++) {
      newDigits[i] = pastedText[i] || "";
    }
    setDigits(newDigits);
    setError("");

    const nextIndex = Math.min(pastedText.length, OTP_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const fullOtp = digits.join("");

  const submitVerification = useCallback(
    async (codeToVerify) => {
      const otpCode = codeToVerify || fullOtp;
      if (otpCode.length < OTP_LENGTH) {
        setError("Please enter the complete 6-digit verification code.");
        return;
      }

      setError("");
      setLoading(true);

      try {
        const res = await axiosInstance.post("/auth/verify-signup-otp", {
          email,
          otp: otpCode,
        });

        setIsVerified(true);
        setSuccessMessage("Email verified successfully! Redirecting...");

        login(res.data.token, res.data.user);

        setTimeout(() => {
          if (res.data.user.role === "admin") {
            navigate("/admin/dashboard");
          } else if (res.data.user.role === "node_participant") {
            navigate("/node/dashboard");
          } else {
            navigate("/client/dashboard");
          }
        }, 1000);
      } catch (err) {
        setError(err.response?.data?.message || "Invalid or expired verification code.");
      } finally {
        setLoading(false);
      }
    },
    [email, fullOtp, login, navigate]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    submitVerification();
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError("");
    setSuccessMessage("");
    setResending(true);

    try {
      const res = await axiosInstance.post("/auth/resend-signup-otp", { email });
      setCooldown(RESEND_COOLDOWN_SECONDS);

      if (import.meta.env.DEV && res.data.devOtp) {
        setDevOtp(res.data.devOtp);
      }

      setSuccessMessage("A fresh verification code has been sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend code. Please try again shortly.");
    } finally {
      setResending(false);
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
                  stroke="url(#brandGradOtp)"
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
                  <linearGradient id="brandGradOtp" x1="2.5" y1="2" x2="21.5" y2="22" gradientUnits="userSpaceOnUse">
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

      {/* Main View */}
      <main className="ps-main-container">
        <div className="ps-otp-wrapper">
          <div className="ps-card ps-otp-card">
            <div className="ps-eyebrow">
              <span className="ps-eyebrow-dot" />
              <span>ACCOUNT VERIFICATION</span>
            </div>

            <h1 className="ps-card-title">Verify your email.</h1>
            <p className="ps-card-subtitle">
              We sent a 6-digit confirmation code to{" "}
              <strong className="ps-target-email">{email}</strong>
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

            {/* Development OTP Banner (Local Dev Only) */}
            {import.meta.env.DEV && devOtp && (
              <div className="ps-alert-dev" role="note">
                <span className="ps-dev-badge">DEV ONLY</span>
                <span>OTP Code: <strong>{devOtp}</strong></span>
                <button
                  type="button"
                  className="ps-dev-fill-btn"
                  onClick={() => {
                    const chars = String(devOtp).split("").slice(0, OTP_LENGTH);
                    setDigits(chars);
                    submitVerification(String(devOtp));
                  }}
                >
                  Auto-fill
                </button>
              </div>
            )}

            <form className="ps-form" onSubmit={handleSubmit}>
              <div className="ps-otp-inputs" onPaste={handlePaste}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={`ps-otp-digit ${digit ? "has-value" : ""}`}
                    aria-label={`Digit ${index + 1}`}
                    disabled={loading || isVerified}
                  />
                ))}
              </div>

              <button
                className="ps-submit-btn"
                type="submit"
                disabled={loading || fullOtp.length < OTP_LENGTH || isVerified}
              >
                {loading ? "Verifying..." : isVerified ? "Verified!" : "Verify Email"}
              </button>

              <div className="ps-otp-resend-row">
                <span className="ps-link-muted">Didn't receive the code?</span>
                <button
                  type="button"
                  className="ps-resend-btn"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending || loading}
                >
                  {resending ? (
                    <>
                      <RotateCw size={13} className="ps-spin" />
                      <span>Resending...</span>
                    </>
                  ) : cooldown > 0 ? (
                    <span>Resend in {cooldown}s</span>
                  ) : (
                    <span>Resend code</span>
                  )}
                </button>
              </div>

              <div className="ps-card-footer-links">
                <p className="ps-link-line">
                  <Link to="/login" className="ps-link-action">
                    Back to Login &raquo;
                  </Link>
                </p>
                <p className="ps-link-line">
                  <Link to="/register" className="ps-link-muted">
                    Register with another email
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

export default VerifySignupOtp;
