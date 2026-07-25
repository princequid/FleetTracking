import React from "react";
import { useNavigate } from "react-router-dom";
import { getInitials, getAvatarColor } from "../../constants/colors";
import Badge from "../common/Badge";

export default function DriverTable({ drivers, canDeactivate, onDeactivate }) {
  const navigate = useNavigate();

  return (
    <table className="trips-data-table">
      <thead>
        <tr>
          <th>Driver</th>
          <th>Phone</th>
          <th>Licence</th>
          <th>Status</th>
          <th>Performance</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {drivers.map((driver) => (
          <tr key={driver.id} onClick={() => navigate(`/drivers/${driver.id}`)}>
            <td>
              <div className="driver-name-cell">
                <span className="driver-avatar" style={{ background: getAvatarColor(driver.fullName) }}>
                  {getInitials(driver.fullName)}
                </span>
                <span>{driver.fullName}</span>
              </div>
            </td>
            <td>{driver.phone || "—"}</td>
            <td>{driver.licenceNo || "—"}</td>
            <td>
              <Badge variant={driver.isActive ? "success" : "default"}>
                {driver.isActive ? "Active" : "Inactive"}
              </Badge>
            </td>
            <td>
              <div className="performance-bar-wrapper">
                <div className="performance-bar-track">
                  <div
                    className="performance-bar-fill"
                    style={{ width: `${driver.performanceScore || 0}%` }}
                  />
                </div>
                <span className="performance-bar-label">{driver.performanceScore || 0}%</span>
              </div>
            </td>
            <td className="trip-actions-cell" onClick={(event) => event.stopPropagation()}>
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
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
