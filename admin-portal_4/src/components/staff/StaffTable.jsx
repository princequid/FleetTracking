import React from "react";
import { getInitials, getAvatarColor } from "../../constants/colors";
import Badge from "../common/Badge";
import DataTable from "../common/DataTable";
import { EmptyStaffIllustration } from "../common/Icons";
import { formatDate, formatFull } from "../../utils/formatDate";

const ROLE_BADGE_VARIANT = {
  SUPER_ADMIN: "danger",
  ADMIN: "info",
  DISPATCHER: "warning",
};

const ROLE_LABELS = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  DISPATCHER: "Dispatcher",
};

/** Highest privilege first, so the accounts that matter most are at the top. */
const ROLE_RANK = { SUPER_ADMIN: 0, ADMIN: 1, DISPATCHER: 2 };

export default function StaffTable({ staff, loading, error, onRetry, onAdd, sort, onSortChange }) {
  const columns = [
    {
      key: "email",
      header: "Account",
      sortable: true,
      card: "title",
      render: (member) => (
        <div className="driver-name-cell">
          <span
            className="driver-avatar"
            style={{ background: getAvatarColor(member.email) }}
            aria-hidden="true"
          >
            {getInitials(member.email)}
          </span>
          <span className="driver-name-text">{member.email}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: 160,
      sortable: true,
      card: "meta",
      sortValue: (member) => ROLE_RANK[member.role] ?? 99,
      render: (member) => (
        <Badge variant={ROLE_BADGE_VARIANT[member.role] || "default"}>
          {ROLE_LABELS[member.role] || member.role}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Added",
      width: 150,
      align: "end",
      sortable: true,
      sortValue: (member) => (member.createdAt ? new Date(member.createdAt).getTime() : 0),
      render: (member) =>
        member.createdAt ? (
          <span title={formatFull(member.createdAt)}>{formatDate(member.createdAt)}</span>
        ) : (
          <span className="cell-muted">—</span>
        ),
    },
  ];

  return (
    <DataTable
      label="Staff"
      caption="Staff accounts with their role and the date they were added"
      columns={columns}
      rows={staff}
      rowKey={(member) => member.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={{
        illustration: EmptyStaffIllustration,
        title: "No staff accounts yet",
        subtitle: "Add an admin or dispatcher so someone can operate the portal.",
        action: onAdd ? { label: "Add staff", onClick: onAdd } : undefined,
      }}
      sort={sort}
      onSortChange={onSortChange}
    />
  );
}
