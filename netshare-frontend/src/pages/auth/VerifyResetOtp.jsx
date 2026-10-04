import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Network } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import "./Register.css";

function VerifyResetOtp() {
  const navigate = useNavigate();
  const location = useLocation();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const email = location.state?.email || "";
  const devOtp = location.state?.devOtp;

  useEffect(() => {
    if (!email) {
      navigate("/forgot-password");
    }
    if (devOtp) {
      setMessage(`[DEV ONLY] Your Reset OTP is: ${devOtp}`);
    }
  }, [email, devOtp, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axiosInstance.post("/auth/verify-reset-otp", { email, otp });
      
      // Navigate to reset password page, passing email and OTP (to authorize reset)
      navigate("/reset-password", {
        state: { 
          email: email,
          otp: otp 
        }
      });
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
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
        </div>
        <div className="hero-text">
          <h2>Verify Reset OTP</h2>
          <p>Please enter the OTP sent to {email} to reset your password.</p>
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
            {loading ? "Verifying..." : "Verify OTP"}
          </button>

          <p className="switch-text">
            <Link to="/login">Back to Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default VerifyResetOtp;
