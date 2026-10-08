import { useState, useEffect } from "react";
import { getProfile, updateProfile, changePassword } from "../../api/userApi";
import { useAuth } from "../../context/authState";
import "./Profile.css"; // We'll create a basic CSS

function Profile() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState({ name: "", phone: "", profileImage: "" });
  const [passData, setPassData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passMessage, setPassMessage] = useState("");
  const [passError, setPassError] = useState("");

  async function fetchProfile() {
    try {
      const res = await getProfile();
      setProfileData({
        name: res.user.name || "",
        phone: res.user.phone || "",
        profileImage: res.user.profileImage || ""
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
        profileImage: profileData.profileImage
      });
      setMessage(res.message);
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
        newPassword: passData.newPassword
      });
      setPassMessage(res.message);
      setPassData({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPassError(err.response?.data?.message || "Failed to change password");
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <h1>My Profile</h1>
      
      <div className="profile-section">
        <p><strong>Role:</strong> {user?.role}</p>
      </div>

      <div className="profile-section">
        <h2>Update Profile Info</h2>
        {error && <div className="error-msg">{error}</div>}
        {message && <div className="success-msg">{message}</div>}
        <form onSubmit={handleProfileUpdate}>
          <label>Name</label>
          <input 
            type="text" 
            value={profileData.name} 
            onChange={(e) => setProfileData({...profileData, name: e.target.value})} 
            required 
          />
          <label>Phone</label>
          <input 
            type="text" 
            value={profileData.phone} 
            onChange={(e) => setProfileData({...profileData, phone: e.target.value})} 
          />
          <label>Profile Image URL</label>
          <input 
            type="text" 
            value={profileData.profileImage} 
            onChange={(e) => setProfileData({...profileData, profileImage: e.target.value})} 
          />
          <button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Profile"}</button>
        </form>
      </div>

      <div className="profile-section">
        <h2>Change Password</h2>
        {passError && <div className="error-msg">{passError}</div>}
        {passMessage && <div className="success-msg">{passMessage}</div>}
        <form onSubmit={handleChangePassword}>
          <label>Old Password</label>
          <input 
            type="password" 
            value={passData.oldPassword} 
            onChange={(e) => setPassData({...passData, oldPassword: e.target.value})} 
            required 
          />
          <label>New Password</label>
          <input 
            type="password" 
            value={passData.newPassword} 
            onChange={(e) => setPassData({...passData, newPassword: e.target.value})} 
            required 
          />
          <label>Confirm New Password</label>
          <input 
            type="password" 
            value={passData.confirmPassword} 
            onChange={(e) => setPassData({...passData, confirmPassword: e.target.value})} 
            required 
          />
          <button type="submit" disabled={passLoading}>{passLoading ? "Changing..." : "Change Password"}</button>
        </form>
      </div>
    </div>
  );
}

export default Profile;
