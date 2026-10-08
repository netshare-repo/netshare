import { useEffect, useState } from "react";
import axiosInstance from "../../api/axiosInstance";
import AdminLayout from "../../layouts/AdminLayout";
import "./Payments.css";

function Payments() {
  const [topUps, setTopUps] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [approvedWithdrawals, setApprovedWithdrawals] = useState([]);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const refresh = async () => {
    try {
      const [topUpRes, withdrawalRes, approvedRes] = await Promise.all([
        axiosInstance.get("/admin/payments/top-ups"),
        axiosInstance.get("/admin/payments/withdrawals"),
        axiosInstance.get("/admin/payments/withdrawals?status=approved"),
      ]);
      setTopUps(topUpRes.data.requests || []);
      setWithdrawals(withdrawalRes.data.requests || []);
      setApprovedWithdrawals(approvedRes.data.requests || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not load payment requests");
    }
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const act = async (type, id, action) => {
    setBusy(id);
    setError("");
    try {
      await axiosInstance.post(`/admin/payments/${type}/${id}/${action}`, { adminNote: notes[id] || "" });
      setNotes((current) => ({ ...current, [id]: "" }));
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Payment action failed");
    } finally {
      setBusy("");
    }
  };

  const downloadProof = async (id) => {
    try {
      const response = await axiosInstance.get(`/admin/payments/top-ups/${id}/proof`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `topup-${id}.${response.data.type === "application/pdf" ? "pdf" : response.data.type === "image/png" ? "png" : "jpg"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.response?.data?.message || "Could not download proof");
    }
  };

  const noteInput = (id) => <label>Admin note<input maxLength="500" value={notes[id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [id]: event.target.value }))} /></label>;

  return <AdminLayout><div className="payments-page">
    <h1>Manual Payment Verification</h1>
    <p>Verify the payment reference and proof outside NetShare before approving a top-up. Mark a withdrawal processed only after completing the external payout.</p>
    {error && <p role="alert" className="payment-error">{error}</p>}
    <section><h2>Pending Top-Ups</h2>{topUps.length === 0 ? <p>No pending top-ups.</p> : topUps.map((item) => <article className="payment-request" key={item._id}>
      <div><strong>{item.userId?.email}</strong> · {item.amount} credits · {item.paymentMethod} · reference {item.referenceNumber}</div>
      <div className="payment-actions"><button type="button" onClick={() => downloadProof(item._id)}>Download proof</button>{noteInput(item._id)}<button type="button" disabled={busy === item._id} onClick={() => act("top-ups", item._id, "approve")}>Approve</button><button type="button" disabled={busy === item._id} onClick={() => act("top-ups", item._id, "reject")}>Reject</button></div>
    </article>)}</section>
    <section><h2>Pending Withdrawals</h2>{withdrawals.length === 0 ? <p>No pending withdrawals.</p> : withdrawals.map((item) => <article className="payment-request" key={item._id}>
      <div><strong>{item.userId?.email}</strong> · {item.amount} credits · {item.method} · account {item.accountDetails}</div>
      <div className="payment-actions">{noteInput(item._id)}<button type="button" disabled={busy === item._id} onClick={() => act("withdrawals", item._id, "approve")}>Approve</button><button type="button" disabled={busy === item._id} onClick={() => act("withdrawals", item._id, "reject")}>Reject and refund</button></div>
    </article>)}</section>
    <section><h2>Approved Withdrawals Awaiting Payout</h2>{approvedWithdrawals.length === 0 ? <p>None awaiting payout.</p> : approvedWithdrawals.map((item) => <article className="payment-request" key={item._id}>
      <div><strong>{item.userId?.email}</strong> · {item.amount} credits · {item.method} · account {item.accountDetails}</div>
      <div className="payment-actions">{noteInput(item._id)}<button type="button" disabled={busy === item._id} onClick={() => act("withdrawals", item._id, "process")}>Mark processed after payout</button><button type="button" disabled={busy === item._id} onClick={() => act("withdrawals", item._id, "reject")}>Reject and refund</button></div>
    </article>)}</section>
  </div></AdminLayout>;
}

export default Payments;
