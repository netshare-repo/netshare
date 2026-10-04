import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "./ErrorMessage.css";

function ErrorMessage({ message = "An error occurred", onRetry }) {
  return (
    <div className="error-message-box">
      <div className="error-icon">
        <AlertTriangle size={20} />
      </div>
      <div className="error-content">
        <p className="error-text">{message}</p>
      </div>
      {onRetry && (
        <button className="error-retry-btn" onClick={onRetry}>
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
