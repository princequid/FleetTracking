import React, { useEffect, useMemo, useState } from "react";
import { getVehicles, createVehicle, updateVehicle } from "../services/vehicleService";
import Modal from "../components/common/Modal";
import Button from "../components/common/Button";
import { useToast } from "../components/common/Toast";
import FilterTabs from "../components/common/FilterTabs";
import { CarIcon, PlusCircleIcon, SearchIcon } from "../components/common/Icons";
import { VEHICLE_FILTER_TABS, getVehicleStatusStyle } from "../constants/vehicleStatus";

export default function VehiclesPage() {
  const showToast = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [plateNumber, setPlateNumber] = useState("");
  const [model, setModel] = useState("");
  const [capacity, setCapacity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadVehicles() {
    setLoading(true);
    setError("");
    getVehicles()
      .then(setVehicles)
      .catch(() => setError("Unable to load vehicles."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const counts = useMemo(() => {
    const base = { All: vehicles.length };
    vehicles.forEach((vehicle) => {
      const label = VEHICLE_FILTER_TABS.find(
        (tab) => tab !== "All" && tab.toUpperCase().replace(" ", "_") === vehicle.status
      );
      if (label) base[label] = (base[label] || 0) + 1;
    });
    return base;
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    let result = filter === "All" ? vehicles : vehicles.filter((v) => v.status === filter.toUpperCase().replace(" ", "_"));
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (v) => v.plateNumber?.toLowerCase().includes(q) || v.model?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [vehicles, filter, debouncedSearch]);

  function openAddModal() {
    setEditingVehicle(null);
    setPlateNumber("");
    setModel("");
    setCapacity("");
    setModalOpen(true);
  }

  function openEditModal(vehicle) {
    setEditingVehicle(vehicle);
    setPlateNumber(vehicle.plateNumber);
    setModel(vehicle.model || "");
    setCapacity(vehicle.capacity != null ? String(vehicle.capacity) : "");
    setModalOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = { plateNumber, model, capacity: Number(capacity) };
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, payload);
        showToast("success", "Vehicle Updated", `${plateNumber} saved successfully.`);
      } else {
        await createVehicle(payload);
        showToast("success", "Vehicle Added", `${plateNumber} added to the fleet.`);
      }
      setModalOpen(false);
      loadVehicles();
    } catch (err) {
      showToast("error", "Save Failed", err.response?.data?.error || "Failed to save vehicle.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header-row">
        <h1>Vehicles</h1>
        <Button variant="primary" onClick={openAddModal}>
          <PlusCircleIcon size={16} />
          <span>Add Vehicle</span>
        </Button>
      </div>

      <FilterTabs tabs={VEHICLE_FILTER_TABS} active={filter} counts={counts} onChange={setFilter} />

      <div className="search-bar-wrapper">
        <SearchIcon size={16} className="search-bar-icon" />
        <input
          className="search-bar-input"
          placeholder="Search by plate number or model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="trips-table-card">
        {loading ? (
          <div className="loading-text">Loading vehicles…</div>
        ) : filteredVehicles.length === 0 ? (
          <div className="trips-empty-state">
            <CarIcon size={64} className="trips-empty-icon" />
            <h2 className="trips-empty-title">No vehicles found</h2>
            <p className="trips-empty-subtitle">Add your first vehicle to get started</p>
            <button className="trips-empty-cta" type="button" onClick={openAddModal}>
              Add Vehicle
            </button>
          </div>
        ) : (
          <table className="trips-data-table">
            <thead>
              <tr>
                <th>Plate Number</th>
                <th>Model</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((vehicle) => {
                const style = getVehicleStatusStyle(vehicle.status);
                return (
                  <tr key={vehicle.id}>
                    <td>{vehicle.plateNumber}</td>
                    <td>{vehicle.model || "—"}</td>
                    <td>{vehicle.capacity != null ? `${vehicle.capacity} kg` : "—"}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ background: style.background, color: style.color }}
                      >
                        {vehicle.status}
                      </span>
                    </td>
                    <td className="trip-actions-cell">
                      <button
                        className="trip-view-btn"
                        type="button"
                        onClick={() => openEditModal(vehicle)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingVehicle ? "Edit Vehicle" : "Add Vehicle"}
        size="sm"
      >
        <form className="dispatch-form" onSubmit={handleSubmit}>
          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="vehicle-plate">
              Plate Number
            </label>
            <input
              id="vehicle-plate"
              className="dispatch-input"
              value={plateNumber}
              onChange={(event) => setPlateNumber(event.target.value)}
              required
            />
          </div>
          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="vehicle-model">
              Model
            </label>
            <input
              id="vehicle-model"
              className="dispatch-input"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </div>
          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="vehicle-capacity">
              Capacity
            </label>
            <div className="input-with-unit">
              <input
                id="vehicle-capacity"
                className="dispatch-input"
                type="number"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                required
              />
              <span className="input-unit-label">kg</span>
            </div>
          </div>
          <Button type="submit" variant="primary" loading={submitting} className="modal-submit-btn">
            {editingVehicle ? "Save Changes" : "Add Vehicle"}
          </Button>
        </form>
      </Modal>

    </div>
  );
}
