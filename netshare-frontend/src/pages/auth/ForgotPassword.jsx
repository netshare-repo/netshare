import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Network } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import "./Register.css";

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleRequest = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await axiosInstance.post("/auth/forgot-password", { email });
      
      // Redirect to OTP verification page, passing the email and optional devOtp
      navigate("/verify-reset-otp", {
        state: { 
          email: email,
          devOtp: res.data.devOtp 
        }
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to request password reset");
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
          <h2>Forgot Password?</h2>
          <p>Enter your email to receive a password reset OTP.</p>
        </div>
      </div>

      <div className="auth-right">
        <form className="auth-card" onSubmit={handleRequest}>
          <h2>Reset Password</h2>
          <p className="auth-subtitle">We will send an OTP to your email</p>

          {error && <div className="auth-error">{error}</div>}
          {message && <div style={{ color: 'var(--primary-color)', marginBottom: '15px' }}>{message}</div>}

          <label>Email Address</label>
          <input
            type="email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Requesting..." : "Send Reset OTP"}
          </button>

          <p className="switch-text">
            Remembered your password? <Link to="/login">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
