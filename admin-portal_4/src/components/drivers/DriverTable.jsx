import React from "react";
import { useNavigate } from "react-router-dom";
import { getInitials, getAvatarColor } from "../../constants/colors";
import Badge from "../common/Badge";
import DataTable from "../common/DataTable";
import { EmptyDriversIllustration } from "../common/Icons";

export default function DriverTable({
  drivers,
  canDeactivate,
  onDeactivate,
  loading,
  error,
  onRetry,
  onAdd,
  isFiltered,
  onClearFilters,
  sort,
  onSortChange,
  page,
  pageSize,
  onPageChange,
}) {
  const navigate = useNavigate();

  const columns = [
    {
      key: "fullName",
      header: "Driver",
      sortable: true,
      card: "title",
      render: (driver) => (
        <div className="driver-name-cell">
          <span
            className="driver-avatar"
            style={{ background: getAvatarColor(driver.fullName) }}
            aria-hidden="true"
          >
            {getInitials(driver.fullName)}
          </span>
          <span className="driver-name-text">{driver.fullName}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      width: 180,
      render: (driver) =>
        driver.phone ? (
          <span className="cell-mono">{driver.phone}</span>
        ) : (
          <span className="cell-muted">—</span>
        ),
    },
    {
      key: "licenceNo",
      header: "Licence",
      width: 160,
      sortable: true,
      hideBelow: "md",
      render: (driver) =>
        driver.licenceNo ? (
          <span className="cell-mono">{driver.licenceNo}</span>
        ) : (
          <span className="cell-muted">—</span>
        ),
    },
    {
      key: "isActive",
      header: "Status",
      width: 120,
      sortable: true,
      card: "meta",
      sortValue: (driver) => (driver.isActive ? 0 : 1),
      render: (driver) => (
        <Badge variant={driver.isActive ? "success" : "default"} dot>
          {driver.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: 150,
      align: "end",
      card: "actions",
      render: (driver) => (
        <div className="cell-actions" onClick={(event) => event.stopPropagation()}>
          <button
            className="trip-view-btn"
            type="button"
            onClick={() => navigate(`/drivers/${driver.id}`)}
          >
            View
          </button>
          {canDeactivate && driver.isActive && (
            <button
              className="driver-deactivate-btn"
              type="button"
              onClick={() => onDeactivate(driver)}
            >
              Deactivate
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      label="Drivers"
      caption="Drivers with contact details, licence and status"
      columns={columns}
      rows={drivers}
      rowKey={(driver) => driver.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={
        isFiltered
          ? {
              variant: "filtered",
              title: "No drivers match your search",
              subtitle: "Try a different name, licence number or phone number.",
              action: onClearFilters
                ? { label: "Clear search", onClick: onClearFilters }
                : undefined,
            }
          : {
              illustration: EmptyDriversIllustration,
              title: "No drivers registered",
              subtitle: "Add a driver to start assigning them to trips.",
              action: onAdd ? { label: "Add driver", onClick: onAdd } : undefined,
            }
      }
      onRowActivate={(driver) => navigate(`/drivers/${driver.id}`)}
      rowLabel={(driver) => `View ${driver.fullName}`}
      sort={sort}
      onSortChange={onSortChange}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
    />
  );
}
