import React, { useEffect, useMemo, useState } from "react";
import { getDrivers, deactivateDriver } from "../services/driverService";
import { getTrips } from "../services/tripService";
import { useAuthStore } from "../store/authStore";
import StatCard from "../components/common/StatCard";
import Modal from "../components/common/Modal";
import Button from "../components/common/Button";
import { useToast } from "../components/common/Toast";
import DriverForm from "../components/drivers/DriverForm";
import DriverTable from "../components/drivers/DriverTable";
import { UsersIcon, CheckCircleIcon, TruckIcon, SearchIcon, PlusCircleIcon } from "../components/common/Icons";

export default function DriversPage() {
  const role = useAuthStore((state) => state.role);
  const showToast = useToast();
  const [drivers, setDrivers] = useState([]);
  const [onDutyCount, setOnDutyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  function loadDrivers() {
    setLoading(true);
    setError("");
    Promise.all([getDrivers(), getTrips()])
      .then(([driverData, trips]) => {
        setDrivers(driverData);
        const onDutyIds = new Set(
          trips
            .filter((trip) => trip.status === "STARTED" || trip.status === "EN_ROUTE")
            .map((trip) => trip.driverId)
        );
        setOnDutyCount(onDutyIds.size);
      })
      .catch(() => setError("Unable to load drivers."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredDrivers = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return drivers;
    return drivers.filter(
      (driver) =>
        driver.fullName?.toLowerCase().includes(query) ||
        driver.licenceNo?.toLowerCase().includes(query) ||
        driver.phone?.toLowerCase().includes(query)
    );
  }, [drivers, debouncedSearch]);

  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter((driver) => driver.isActive).length;

  function handleAddComplete() {
    setAddModalOpen(false);
    showToast("success", "Driver Added", "Driver registered successfully.");
    loadDrivers();
  }

  function handleFormError(message) {
    showToast("error", "Error", message);
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    try {
      await deactivateDriver(deactivateTarget.id);
      showToast("success", "Driver Deactivated", `${deactivateTarget.fullName} has been deactivated.`);
      loadDrivers();
    } catch {
      showToast("error", "Error", "Failed to deactivate driver.");
    } finally {
      setDeactivateTarget(null);
    }
  }

  return (
    <div>
      <div className="page-header-row">
        <h1>Drivers</h1>
        <Button variant="primary" onClick={() => setAddModalOpen(true)}>
          <PlusCircleIcon size={16} />
          <span>Add Driver</span>
        </Button>
      </div>

      <div className="stats-row">
        <StatCard
          className="stagger-child"
          title="Total Drivers"
          value={totalDrivers}
          icon={UsersIcon}
          color="#3B82F6"
        />
        <StatCard
          className="stagger-child"
          title="Active Drivers"
          value={activeDrivers}
          icon={CheckCircleIcon}
          color="#06B6D4"
        />
        <StatCard
          className="stagger-child"
          title="On Duty Today"
          value={onDutyCount}
          icon={TruckIcon}
          color="#F59E0B"
        />
      </div>

      <div className="search-bar-wrapper">
        <SearchIcon size={16} className="search-bar-icon" />
        <input
          className="search-bar-input"
          placeholder="Search by name, licence, phone..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="trips-table-card">
        {loading ? (
          <div className="loading-text">Loading drivers…</div>
        ) : filteredDrivers.length === 0 ? (
          <div className="trips-empty-state">
            <UsersIcon size={64} className="trips-empty-icon" />
            <h2 className="trips-empty-title">No drivers registered</h2>
            <p className="trips-empty-subtitle">Add your first driver to get started</p>
          </div>
        ) : (
          <DriverTable
            drivers={filteredDrivers}
            canDeactivate={role === "SUPER_ADMIN"}
            onDeactivate={(driver) => setDeactivateTarget(driver)}
          />
        )}
      </div>

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Driver" size="md">
        <DriverForm onComplete={handleAddComplete} onError={handleFormError} />
      </Modal>

      <Modal
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate Driver"
        size="sm"
      >
        <p className="confirm-dialog-text">
          Deactivate {deactivateTarget?.fullName}? They will no longer be assignable to trips.
        </p>
        <div className="confirm-dialog-actions">
          <Button variant="ghost" onClick={() => setDeactivateTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDeactivate}>
            Confirm
          </Button>
        </div>
      </Modal>

    </div>
  );
}
