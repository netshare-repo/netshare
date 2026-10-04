import React from "react";
import "./LoadingSpinner.css";

function LoadingSpinner({ text = "Loading...", size = "md" }) {
  return (
    <div className={`spinner-container spinner-${size}`}>
      <div className="spinner-circle"></div>
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
}

export default LoadingSpinner;
