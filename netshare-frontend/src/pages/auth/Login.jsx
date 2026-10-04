import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Network, Eye, EyeOff } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../../context/AuthContext";
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
    <div className="login-page">
      <div className="login-card-wrapper">
        <div className="login-brand">
          <div className="login-logo">
            <Network size={30} />
          </div>
          <h1>NetShare</h1>
          <p>Client and Admin Web Portal</p>
        </div>

        <form className="login-card" onSubmit={handleLogin}>
          <h2>Welcome Back</h2>
          <p className="login-subtitle">
            Login to manage testing tasks, credits, and monitoring.
          </p>

          {error && <div className="login-error">{error}</div>}

          <label>Email Address</label>
          <input
            type="email"
            name="email"
            placeholder="Enter email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <label>Password</label>
          <div className="login-password-box">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Enter password"
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

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="login-switch">
            <Link to="/forgot-password" style={{ display: 'block', marginBottom: '10px' }}>Forgot Password?</Link>
            New to NetShare? <Link to="/register">Create account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;