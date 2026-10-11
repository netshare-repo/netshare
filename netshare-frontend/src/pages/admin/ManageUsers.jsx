import { useCallback, useEffect, useState } from "react";
import { Search, RefreshCw, ShieldBan, ShieldCheck } from "lucide-react";
import AdminLayout from "../../layouts/AdminLayout";
import { getAdminUsers, getAdminUserDetails, restrictUser, blockUser, unblockUser } from "../../api/adminApi";
import "./ManageUsers.css";

function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState(null);
  const showDetails = async (id) => {
    setDetails(null);
    setUpdatingId(id);
    try { setDetails(await getAdminUserDetails(id)); }
    catch (error) { setMessage(error.response?.data?.message || 'Failed to load user details'); }
    finally { setUpdatingId(''); }
  };
  const handleRestrict = async (id) => {
    const note = window.prompt('Reason for restricting this account to read-only access:');
    if (!note) return;
    setUpdatingId(id);
    try { await restrictUser(id, note); await loadUsers(); setMessage('Account restricted.'); }
    catch (error) { setMessage(error.response?.data?.message || 'Restriction failed'); }
    finally { setUpdatingId(''); }
  };
  
  const [filters, setFilters] = useState({
    search: "",
    role: "",
    status: "",
    isVerified: ""
  });

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      const queryParams = { ...filters };
      Object.keys(queryParams).forEach(k => {
        if (!queryParams[k]) delete queryParams[k];
      });

      const data = await getAdminUsers(queryParams);
      setUsers(data.users || []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadUsers();
  };

  const handleBlock = async (id, currentStatus) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus === 'active' ? 'block' : 'unblock'} this user?`)) return;
    
    try {
      setUpdatingId(id);
      if (currentStatus === 'active') {
        await blockUser(id);
      } else {
        await unblockUser(id);
      }
      setMessage(`User ${currentStatus === 'active' ? 'blocked' : 'unblocked'} successfully.`);
      loadUsers();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to update user status");
    } finally {
      setUpdatingId("");
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadUsers);
  }, [loadUsers]);

  return (
    <AdminLayout>
      <div className="manage-users-page">
        <div className="mu-header">
          <div>
            <h2>Manage Users</h2>
            <p>View, filter, and manage platform users.</p>
          </div>

          <button onClick={loadUsers}>
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        <div className="mu-filters">
          <form onSubmit={handleSearch} className="mu-search-form">
            <Search size={18} />
            <input 
              type="text" 
              name="search"
              placeholder="Search name or email..." 
              value={filters.search}
              onChange={handleFilterChange}
            />
            <button type="submit">Search</button>
          </form>

          <select name="role" value={filters.role} onChange={handleFilterChange}>
            <option value="">All Roles</option>
            <option value="platform_client">Platform Client</option>
            <option value="node_participant">Node Participant</option>
            <option value="both">Both</option>
            <option value="admin">Admin</option>
          </select>

          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="restricted">Restricted (read-only)</option>
          </select>

          <select name="isVerified" value={filters.isVerified} onChange={handleFilterChange}>
            <option value="">Verification</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
        </div>

        {message && <div className="mu-message">{message}</div>}
        {details && <section aria-label="User details" className="mu-message">
          <button onClick={() => setDetails(null)}>Close details</button>
          <h3>{details.user.name}</h3>
          <p>{details.user.email} · {details.user.phone} · {details.user.role} · {details.user.status}</p>
          <p>Joined: {new Date(details.user.createdAt).toLocaleString()} · Verified: {details.user.isVerified ? 'Yes' : 'No'}</p>
          <p>Wallet balance: {details.wallet?.balance ?? 'Not created'} · Earned: {details.wallet?.earnedCredits ?? 0}</p>
          <h4>Nodes (up to 100)</h4>
          {!details.nodes.length && <p>No registered nodes.</p>}
          {details.nodes.map(node => <p key={node._id}>{node.deviceName} · {node.region} · {node.status} · {node.usedBandwidthMB} MB</p>)}
          <h4>Latest tasks (up to 50)</h4>
          {!details.tasks.length && <p>No tasks.</p>}
          {details.tasks.map(task => <p key={task._id}>{task.targetUrl} · {task.status}</p>)}
          <h4>Latest account audit (up to 50)</h4>
          {!details.audit.length && <p>No account actions.</p>}
          {details.audit.map(log => <p key={log._id}>{log.action} · {log.details} · {new Date(log.createdAt).toLocaleString()}</p>)}
        </section>}

        {loading ? (
          <div className="mu-empty">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="mu-empty">No users found.</div>
        ) : (
          <div className="mu-table-wrap">
            <table className="mu-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Verified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="mu-user-info">
                        <strong>{u.name}</strong>
                        <span>{u.email}</span>
                        <span>{u.phone}</span>
                      </div>
                    </td>
                    <td><span className={`mu-badge role-${u.role}`}>{u.role.replace('_', ' ')}</span></td>
                    <td><span className={`mu-badge status-${u.status}`}>{u.status}</span></td>
                    <td>{u.isVerified ? "Yes" : "No"}</td>
                    <td>
                      <button 
                        disabled={updatingId === u._id} onClick={() => showDetails(u._id)}
                      >Details</button>
                      {u.status === 'active' && u.role !== 'admin' && <button disabled={updatingId === u._id}
                        onClick={() => handleRestrict(u._id)}>Restrict</button>}
                      <button
                        className="mu-action-btn"
                        disabled={updatingId === u._id || u.role === 'admin'} // don't block other admins simply
                        onClick={() => handleBlock(u._id, u.status)}
                      >
                        {u.status === 'active' ? <><ShieldBan size={16}/> Block</> : <><ShieldCheck size={16}/> Unblock</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default ManageUsers;
