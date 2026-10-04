import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Network } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../../context/AuthContext";
import "./Register.css"; // Reuse styling

function VerifySignupOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const email = location.state?.email || "";
  const devOtp = location.state?.devOtp;

  useEffect(() => {
    if (!email) {
      navigate("/register");
    }
    if (devOtp) {
      setMessage(`[DEV ONLY] Your OTP is: ${devOtp}`);
    }
  }, [email, devOtp, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axiosInstance.post("/auth/verify-signup-otp", { email, otp });

      login(res.data.token, res.data.user);

      if (res.data.user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/client/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await axiosInstance.post("/auth/resend-signup-otp", { email });
      if (res.data.devOtp) {
        setMessage(`OTP resent. [DEV ONLY] Your OTP is: ${res.data.devOtp}`);
      } else {
        setMessage("OTP has been resent to your email.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="auth-left">
        <div className="brand-box">
          <div className="brand-icon">
            <Network size={34} />
          </div>
          <h1>NetShare</h1>
          <p>Distributed Bandwidth Sharing Platform</p>
        </div>
        <div className="hero-text">
          <h2>Verify Your Email.</h2>
          <p>Please enter the OTP sent to {email} to complete registration.</p>
        </div>
      </div>

      <div className="auth-right">
        <form className="auth-card" onSubmit={handleVerify}>
          <h2>Verify OTP</h2>
          <p className="auth-subtitle">Enter the 6-digit code</p>

          {error && <div className="auth-error">{error}</div>}
          {message && <div style={{ color: 'var(--primary-color)', marginBottom: '15px', padding: '10px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '6px' }}>{message}</div>}

          <label>OTP Code</label>
          <input
            type="text"
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            maxLength={6}
          />

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify & Login"}
          </button>

          <p className="switch-text" style={{ marginTop: "15px" }}>
            Didn't receive code?{" "}
            <button
              type="button"
              onClick={handleResend}
              style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
            >
              Resend OTP
            </button>
          </p>

          <p className="switch-text">
            <Link to="/login">Back to Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default VerifySignupOtp;
