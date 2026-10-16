import { useState, useEffect } from "react";
import { User, Lock, Shield } from "lucide-react";
import { getProfile, updateProfile, changePassword } from "../../api/userApi";
import { useAuth } from "../../context/authState";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import NodeLayout from "../../layouts/NodeLayout";
import AdminLayout from "../../layouts/AdminLayout";
import "./Profile.css";

function Profile() {
  const { user } = useAuth();
  const Layout =
    user?.role === "admin"
      ? AdminLayout
      : user?.role === "node_participant"
      ? NodeLayout
      : ClientLayout;

  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    profileImage: "",
  });
  const [passData, setPassData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passMessage, setPassMessage] = useState("");
  const [passError, setPassError] = useState("");
  const [photo, setPhoto] = useState(null);
  const [role, setRole] = useState("both");
  const [rolePassword, setRolePassword] = useState("");

  const changeRole = async (event) => {
    event.preventDefault();
    if (
      !window.confirm(
        `Change your account role to ${role}? Stop participation and finish tasks first.`
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      await axiosInstance.put("/users/role", {
        role,
        password: rolePassword,
        confirm: true,
      });
      window.location.assign("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Role change failed");
    } finally {
      setLoading(false);
      setRolePassword("");
    }
  };

  const pickPhoto = async (event) => {
    const file = event.target.files?.[0];
    setPhoto(null);
    if (!file) return;
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Choose a PNG/JPEG image of at most 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read image.");
    reader.onload = () => {
      setPhoto({
        mimeType: file.type,
        base64: String(reader.result).split(",")[1],
      });
      setError("");
    };
    reader.readAsDataURL(file);
  };

  async function fetchProfile() {
    try {
      const res = await getProfile();
      setProfileData({
        name: res.user.name || "",
        phone: res.user.phone || "",
        profileImage: res.user.profileImage || "",
      });
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(fetchProfile);
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await updateProfile({
        name: profileData.name,
        phone: profileData.phone,
        ...(photo ? { photo } : {}),
      });
      setMessage(res.message);
      setProfileData((prev) => ({
        ...prev,
        profileImage: res.user.profileImage,
      }));
      setPhoto(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassLoading(true);
    setPassError("");
    setPassMessage("");

    if (passData.newPassword !== passData.confirmPassword) {
      setPassError("New passwords do not match");
      setPassLoading(false);
      return;
    }

    try {
      const res = await changePassword({
        oldPassword: passData.oldPassword,
        newPassword: passData.newPassword,
      });
      setPassMessage(res.message);
      setPassData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPassError(err.response?.data?.message || "Failed to change password");
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <Layout pageTitle="Settings" pageSubtitle="">
      <div className="ps-profile-page">
        {/* Header */}
        <div className="ps-page-header">
          <div>
            <h1 className="ps-page-title">Account Settings</h1>
            <p className="ps-page-subtitle">
              Manage your personal identity, credentials, security, and account role.
            </p>
          </div>
        </div>

        <div className="ps-profile-grid">
          {/* Card 1: Profile Information */}
          <div className="ps-card ps-profile-card">
            <div className="ps-card-decor" aria-hidden="true">
              <div className="ps-card-decor-outer" />
            </div>

            <div className="ps-card-header-clean" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <User size={18} style={{ color: "#06b6d4" }} />
                <h2 className="ps-card-title">Profile Information</h2>
              </div>
              <span className="ps-meta-label">IDENTITY DETAILS</span>
            </div>

            {error && <div className="ps-alert error">{error}</div>}
            {message && <div className="ps-alert success">{message}</div>}

            <form onSubmit={handleProfileUpdate}>
              <div className="ps-form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, name: e.target.value })
                  }
                  className="ps-input"
                  required
                />
              </div>

              <div className="ps-form-group">
                <label>Phone Number (Optional)</label>
                <input
                  type="text"
                  placeholder="+1 (555) 000-0000"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData({ ...profileData, phone: e.target.value })
                  }
                  className="ps-input"
                />
              </div>

              <div className="ps-form-group">
                <label>Profile Avatar (PNG/JPEG, Max 2 MB)</label>
                {profileData.profileImage?.startsWith("data:image/") && (
                  <div style={{ marginBottom: 10 }}>
                    <img
                      src={profileData.profileImage}
                      alt="Profile Avatar"
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        border: "1px solid #292a2e",
                      }}
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={pickPhoto}
                  disabled={loading}
                  className="ps-input"
                  style={{ paddingTop: 8 }}
                />
              </div>

              <div style={{ marginTop: 24 }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="ps-btn-white"
                  style={{ height: 42 }}
                >
                  {loading ? "Saving..." : "Save Profile Details"}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Security & Password */}
          <div className="ps-card ps-security-card">
            <div className="ps-card-decor" aria-hidden="true">
              <div className="ps-card-decor-outer" />
            </div>

            <div className="ps-card-header-clean" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Lock size={18} style={{ color: "#a855f7" }} />
                <h2 className="ps-card-title">Security &amp; Password</h2>
              </div>
              <span className="ps-meta-label">AUTHENTICATION</span>
            </div>

            {passError && <div className="ps-alert error">{passError}</div>}
            {passMessage && (
              <div className="ps-alert success">{passMessage}</div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="ps-form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passData.oldPassword}
                  onChange={(e) =>
                    setPassData({
                      ...passData,
                      oldPassword: e.target.value,
                    })
                  }
                  className="ps-input"
                  required
                />
              </div>

              <div className="ps-form-group">
                <label>New Password (Min 8 Chars)</label>
                <input
                  type="password"
                  value={passData.newPassword}
                  onChange={(e) =>
                    setPassData({
                      ...passData,
                      newPassword: e.target.value,
                    })
                  }
                  className="ps-input"
                  required
                />
              </div>

              <div className="ps-form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passData.confirmPassword}
                  onChange={(e) =>
                    setPassData({
                      ...passData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="ps-input"
                  required
                />
              </div>

              <div style={{ marginTop: 24 }}>
                <button
                  type="submit"
                  disabled={passLoading}
                  className="ps-btn-white"
                  style={{ height: 42 }}
                >
                  {passLoading ? "Updating..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>

          {/* Card 3: Account Role (Full Width) */}
          {user?.role !== "admin" && (
            <div className="ps-card ps-role-card">
              <div className="ps-card-header-clean" style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Shield size={18} style={{ color: "#f59e0b" }} />
                  <h2 className="ps-card-title">Account Role &amp; Permissions</h2>
                </div>
                <span className="ps-meta-label">CURRENT ROLE: {user?.role}</span>
              </div>

              <p className="ps-desc-text" style={{ marginBottom: 20 }}>
                Switching your account role modifies which panels and routes you can
                access. Ensure in-flight tasks and active node participation sessions are
                completed before changing roles.
              </p>

              <form onSubmit={changeRole}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 20,
                  }}
                >
                  <div className="ps-form-group">
                    <label>Select Target Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="ps-select"
                    >
                      <option value="platform_client">Platform Client (Task Submitter)</option>
                      <option value="node_participant">Node Participant (Bandwidth Contributor)</option>
                      <option value="both">Both (Dual Client &amp; Node)</option>
                    </select>
                  </div>

                  <div className="ps-form-group">
                    <label>Confirm Current Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter password to authorize role change"
                      value={rolePassword}
                      onChange={(e) => setRolePassword(e.target.value)}
                      className="ps-input"
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="ps-btn-dark"
                    style={{ height: 42 }}
                  >
                    Authorize Role Change
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default Profile;
