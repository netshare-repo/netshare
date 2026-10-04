import React from "react";
import "./StatsCard.css";

function StatsCard({
  icon: Icon,
  title,
  value,
  subtitle,
  badge,
  badgeType = "neutral",
  color = "blue",
}) {
  return (
    <div className={`stats-card stats-card-${color}`}>
      <div className="stats-card-header">
        <span className="stats-card-title">{title}</span>
        {Icon && (
          <div className="stats-card-icon-box">
            <Icon size={20} />
          </div>
        )}
      </div>

      <div className="stats-card-body">
        <h3 className="stats-card-value">{value}</h3>
        <div className="stats-card-footer">
          {subtitle && <span className="stats-card-subtitle">{subtitle}</span>}
          {badge && (
            <span className={`stats-card-badge badge-${badgeType}`}>
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default StatsCard;
