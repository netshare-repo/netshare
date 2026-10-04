import React from "react";
import "./StatusBadge.css";

function StatusBadge({ status = "inactive" }) {
  const normStatus = String(status).toLowerCase();

  return (
    <span className={`status-badge status-${normStatus}`}>
      <span className="status-dot"></span>
      <span className="status-label">{status.toUpperCase()}</span>
    </span>
  );
}

export default StatusBadge;
