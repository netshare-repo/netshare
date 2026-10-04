import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Network, Eye, EyeOff } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../../context/AuthContext";
import "./Register.css";

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "platform_client",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axiosInstance.post("/auth/register", form);

      // Redirect to OTP verification page, passing the email and optional devOtp
      navigate("/verify-signup-otp", {
        state: { 
          email: form.email,
          devOtp: res.data.devOtp 
        }
      });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
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
          <h2>Power real-world internet testing.</h2>
          <p>
            Create your account, submit regional testing tasks, monitor results,
            and manage credits through a professional client dashboard.
          </p>
        </div>

        <div className="feature-list">
          <span>✓ Secure API Access</span>
          <span>✓ Credit Based Tasks</span>
          <span>✓ Node Powered Testing</span>
        </div>
      </div>

      <div className="auth-right">
        <form className="auth-card" onSubmit={handleRegister}>
          <h2>Create Account</h2>
          <p className="auth-subtitle">Start using NetShare dashboard</p>

          {error && <div className="auth-error">{error}</div>}

          <label>Full Name</label>
          <input
            type="text"
            name="name"
            placeholder="Enter your name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <label>Email Address</label>
          <input
            type="email"
            name="email"
            placeholder="Enter email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <label>Phone Number</label>
          <input
            type="text"
            name="phone"
            placeholder="03XXXXXXXXX"
            value={form.phone}
            onChange={handleChange}
          />

          <label>Password</label>
          <div className="password-box">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Create password"
              value={form.password}
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

          <label>Select Role</label>
          <select name="role" value={form.role} onChange={handleChange}>
            <option value="platform_client">Platform Client</option>
            <option value="node_participant">Node Participant</option>
            <option value="both">Both (Client & Participant)</option>
          </select>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>

          <p className="switch-text">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Register;