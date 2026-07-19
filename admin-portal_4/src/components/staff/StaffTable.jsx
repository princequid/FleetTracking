import React from "react";
import { getInitials, getAvatarColor } from "../../constants/colors";
import Badge from "../common/Badge";

const ROLE_BADGE_VARIANT = {
  SUPER_ADMIN: "danger",
  ADMIN: "info",
  DISPATCHER: "warning",
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function StaffTable({ staff }) {
  return (
    <table className="trips-data-table">
      <thead>
        <tr>
          <th>Account</th>
          <th>Role</th>
          <th>Added</th>
        </tr>
      </thead>
      <tbody>
        {staff.map((member) => (
          <tr key={member.id}>
            <td>
              <div className="driver-name-cell">
                <span className="driver-avatar" style={{ background: getAvatarColor(member.email) }}>
                  {getInitials(member.email)}
                </span>
                <span>{member.email}</span>
              </div>
            </td>
            <td>
              <Badge variant={ROLE_BADGE_VARIANT[member.role] || "default"}>{member.role}</Badge>
            </td>
            <td>{formatDate(member.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
