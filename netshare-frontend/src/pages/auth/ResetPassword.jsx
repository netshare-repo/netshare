import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Network, Eye, EyeOff } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import "./Register.css";

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const email = location.state?.email || "";
  const otp = location.state?.otp || "";

  useEffect(() => {
    if (!email || !otp) {
      navigate("/forgot-password");
    }
  }, [email, otp, navigate]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await axiosInstance.post("/auth/reset-password", { 
        email, 
        otp, 
        newPassword: form.newPassword 
      });
      
      setMessage(res.data.message);
      
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password");
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
          <h2>Set New Password</h2>
          <p>Create a strong password for your account.</p>
        </div>
      </div>

      <div className="auth-right">
        <form className="auth-card" onSubmit={handleReset}>
          <h2>New Password</h2>
          
          {error && <div className="auth-error">{error}</div>}
          {message && <div style={{ color: '#10b981', marginBottom: '15px', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>{message}</div>}

          <label>New Password</label>
          <div className="password-box">
            <input
              type={showPassword ? "text" : "password"}
              name="newPassword"
              placeholder="Enter new password"
              value={form.newPassword}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label>Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm new password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            style={{ 
              width: "100%", 
              padding: "12px", 
              marginBottom: "15px", 
              border: "1px solid var(--border-color)", 
              borderRadius: "6px", 
              background: "var(--input-bg)", 
              color: "white" 
            }}
          />

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>

          <p className="switch-text">
            <Link to="/login">Back to Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
