import React from "react";

const badgeStyles = {
  confirmed:              { background: "#dbeafe", color: "#1d4ed8" },
  pending:                { background: "#fef3c7", color: "#b45309" },
  "pending admin action": { background: "#fef3c7", color: "#b45309" },
  completed:              { background: "#f3f4f6", color: "#374151" },
  cancelled:              { background: "#fee2e2", color: "#b91c1c" },
  available:              { background: "#dcfce7", color: "#15803d" },
  unavailable:            { background: "#fef3c7", color: "#b45309" },
  active:                 { background: "#dcfce7", color: "#15803d" },
  inactive:               { background: "#f3f4f6", color: "#6b7280" },
  upcoming:               { background: "#dbeafe", color: "#1d4ed8" },
  "in progress":          { background: "#fef3c7", color: "#b45309" },
  "own vehicle":          { background: "#dbeafe", color: "#1d4ed8" },
  "company vehicle":      { background: "#dcfce7", color: "#15803d" },
  "rented vehicle":       { background: "#ede9fe", color: "#7c3aed" },
  unassigned:             { background: "#fee2e2", color: "#b91c1c" },
};

export function StatusBadge({ status }) {
  if (!status) return null;
  const key = status.toLowerCase();
  const s = badgeStyles[key] || { background: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{
      ...s,
      padding: "3px 10px",
      borderRadius: "9999px",
      fontSize: "12px",
      fontWeight: 600,
      display: "inline-block",
      whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
}

export default StatusBadge;
