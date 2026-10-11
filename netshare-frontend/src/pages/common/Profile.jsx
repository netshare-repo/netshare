import { useState, useEffect } from "react";
import { getProfile, updateProfile, changePassword } from "../../api/userApi";
import { useAuth } from "../../context/authState";
import axiosInstance from '../../api/axiosInstance';
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
  const [photo, setPhoto] = useState(null);
  const [role, setRole] = useState('both');
  const [rolePassword, setRolePassword] = useState('');
  const changeRole = async (event) => {
    event.preventDefault();
    if (!window.confirm(`Change your account role to ${role}? Stop participation and finish tasks first.`)) return;
    setLoading(true); setError('');
    try {
      await axiosInstance.put('/users/role', { role, password: rolePassword, confirm: true });
      window.location.assign('/login');
    } catch (err) { setError(err.response?.data?.message || 'Role change failed'); }
    finally { setLoading(false); setRolePassword(''); }
  };
  const pickPhoto = async (event) => {
    const file = event.target.files?.[0];
    setPhoto(null);
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Choose a PNG/JPEG image of at most 2 MB.'); return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError('Could not read image.');
    reader.onload = () => { setPhoto({ mimeType: file.type, base64: String(reader.result).split(',')[1] }); setError(''); };
    reader.readAsDataURL(file);
  };

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
        ...(photo ? { photo } : {})
      });
      setMessage(res.message);
      setProfileData(prev => ({ ...prev, profileImage: res.user.profileImage }));
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
        {user?.role !== 'admin' && <form onSubmit={changeRole}>
          <label>Account role <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="node_participant">Node Participant</option><option value="platform_client">Platform Client</option><option value="both">Both</option>
          </select></label>
          <label>Confirm current password <input type="password" required value={rolePassword} onChange={e => setRolePassword(e.target.value)} /></label>
          <button disabled={loading}>Change account role</button>
        </form>}
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
          <label>Profile photo (PNG/JPEG, maximum 2 MB)</label>
          {profileData.profileImage?.startsWith('data:image/') && <img src={profileData.profileImage} alt="Profile" width="80" height="80" />}
          <input type="file" accept="image/png,image/jpeg" onChange={pickPhoto} disabled={loading} />
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
