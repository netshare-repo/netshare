import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import AdminLayout from "../../layouts/AdminLayout";
import { getAdminNodes, getAdminTasks, getAdminTransactions } from "../../api/adminApi";
import AdminPagination from "./AdminPagination";
import "./AdminDataPage.css";

const definitions = {
  nodes: {
    title: "Registered Nodes",
    description: "Review connected participant devices and their network status.",
    load: getAdminNodes,
    key: "nodes",
    columns: [
      ["Node", (item) => item.deviceName || "Unnamed device", true],
      ["Participant", (item) => item.userId?.name || item.userId?.email || "—"],
      ["Region", (item) => item.region || "—"],
      ["Status", (item) => item.status || "Unknown", false, "status"],
      ["Bandwidth", (item) => `${Number(item.usedBandwidthMB || 0).toFixed(1)} MB`],
      ["Last seen", (item) => item.lastSeen ? new Date(item.lastSeen).toLocaleString() : "—"],
    ],
  },
  tasks: {
    title: "Testing Tasks",
    description: "Inspect task destinations, regional assignments, and execution state.",
    load: getAdminTasks,
    key: "tasks",
    columns: [
      ["Task", (item) => item.targetUrl || "Website test", true],
      ["Client", (item) => item.clientId?.name || item.clientId?.email || "—"],
      ["Service", (item) => (item.serviceType || "—").replaceAll("_", " ")],
      ["Region", (item) => item.targetRegion || "—"],
      ["Status", (item) => item.status || "Unknown", false, "status"],
      ["Created", (item) => item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"],
    ],
  },
  transactions: {
    title: "Credit Transactions",
    description: "Audit issued credits, task charges, and transaction outcomes.",
    load: getAdminTransactions,
    key: "transactions",
    columns: [
      ["User", (item) => item.userId?.name || item.userId?.email || "—", true],
      ["Type", (item) => item.type || "—", false, "status"],
      ["Amount", (item) => `${item.type === "debit" ? "−" : "+"}${item.amount ?? 0} credits`],
      ["Description", (item) => item.description || "—"],
      ["Status", (item) => item.status || "Unknown", false, "status"],
      ["Date", (item) => item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"],
    ],
  },
};

export default function AdminDataPage({ kind }) {
  const config = definitions[kind];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const refresh = useCallback(async () => {
    setPage(1);
    setLoading(true);
    try {
      const data = await config.load();
      setItems(Array.isArray(data?.[config.key]) ? data[config.key] : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || `Could not load ${config.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const newestFirst = [...items].sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
    if (!normalized) return newestFirst;
    return newestFirst.filter((item) => config.columns.some(([, render]) => String(render(item)).toLowerCase().includes(normalized)));
  }, [items, query, config]);
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return <AdminLayout><div className="admin-data-page">
    <div className="admin-data-heading">
      <div><h2>{config.title}</h2><p>{config.description}</p></div>
      <button className="admin-data-refresh" onClick={refresh} disabled={loading}><RefreshCw size={16} className={loading ? "is-spinning" : ""} /> Refresh</button>
    </div>
    <div className="admin-data-toolbar">
      <label><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={`Search ${config.title.toLowerCase()}...`} /></label>
    </div>
    {!loading && !error && <AdminPagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />}
    {error && <div className="admin-data-error" role="alert">{error}</div>}
    {loading ? <div className="admin-data-empty">Loading records…</div> : filtered.length === 0 ? <div className="admin-data-empty">{query ? "No matching records." : "No records to show yet."}</div> :
      <div className="admin-data-table-wrap"><table className="admin-data-table"><thead><tr>{config.columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>
        {pageItems.map((item) => <tr key={item._id}>{config.columns.map(([label, render, primary, cellType]) => <td key={label}>
          {cellType === "status" ? <span className={`admin-data-badge ${String(render(item)).toLowerCase().replaceAll(" ", "-")}`}>{render(item)}</span> : primary ? <strong>{render(item)}</strong> : render(item)}
        </td>)}</tr>)}
      </tbody></table></div>}
  </div></AdminLayout>;
}
