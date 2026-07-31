import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getVehicles, createVehicle, updateVehicle } from "../services/vehicleService";
import Modal from "../components/common/Modal";
import Button from "../components/common/Button";
import FormField from "../components/common/FormField";
import { useFormValidation, required, positiveNumber } from "../hooks/useFormValidation";
import Badge from "../components/common/Badge";
import DataTable from "../components/common/DataTable";
import PageHeader from "../components/common/PageHeader";
import FilterBar from "../components/common/FilterBar";
import SearchBar from "../components/common/SearchBar";
import FilterTabs from "../components/common/FilterTabs";
import { useToast } from "../components/common/Toast";
import { PlusCircleIcon, EmptyVehiclesIllustration } from "../components/common/Icons";
import {
  VEHICLE_FILTER_TABS,
  getVehicleStatusVariant,
  getVehicleStatusLabel,
} from "../constants/vehicleStatus";

const PAGE_SIZE = 12;
const tabToStatus = (tab) => tab.toUpperCase().replace(/\s+/g, "_");

const VEHICLE_VALIDATORS = {
  plateNumber: required("Plate number"),
  capacity: positiveNumber("Capacity"),
};

/* Hoisted so `reset` keeps a stable identity — an inline object literal would
   be a new reference on every render. */
const EMPTY_VEHICLE = { plateNumber: "", model: "", capacity: "" };

export default function VehiclesPage() {
  const showToast = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);

  const vehicleForm = useFormValidation(EMPTY_VEHICLE, VEHICLE_VALIDATORS);

  const loadVehicles = useCallback(() => {
    setLoading(true);
    setError(null);
    getVehicles()
      .then(setVehicles)
      .catch(() =>
        setError({
          title: "Can't load the fleet",
          message: "Vehicle records are unavailable — this is a connection problem, not an empty fleet.",
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const counts = useMemo(() => {
    const base = { All: vehicles.length };
    vehicles.forEach((vehicle) => {
      const label = VEHICLE_FILTER_TABS.find(
        (tab) => tab !== "All" && tabToStatus(tab) === vehicle.status,
      );
      if (label) base[label] = (base[label] || 0) + 1;
    });
    return base;
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    let result =
      filter === "All" ? vehicles : vehicles.filter((v) => v.status === tabToStatus(filter));
    const q = search.toLowerCase();
    if (q) {
      result = result.filter(
        (v) => v.plateNumber?.toLowerCase().includes(q) || v.model?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [vehicles, filter, search]);

  const isFiltered = filter !== "All" || search !== "";

  function clearFilters() {
    setFilter("All");
    setSearch("");
  }

  function openAddModal() {
    setEditingVehicle(null);
    vehicleForm.reset();
    setModalOpen(true);
  }

  function openEditModal(vehicle) {
    setEditingVehicle(vehicle);
    vehicleForm.reset();
    vehicleForm.setValue("plateNumber", vehicle.plateNumber);
    vehicleForm.setValue("model", vehicle.model || "");
    vehicleForm.setValue("capacity", vehicle.capacity != null ? String(vehicle.capacity) : "");
    setModalOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!vehicleForm.validateAll()) {
      requestAnimationFrame(() => vehicleForm.focusFirstError(formRef.current));
      return;
    }
    setSubmitting(true);
    const { plateNumber, model, capacity } = vehicleForm.values;
    try {
      const payload = { plateNumber: plateNumber.trim(), model: model.trim(), capacity: Number(capacity) };
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, payload);
        showToast("success", "Vehicle updated", `${plateNumber} saved successfully.`);
      } else {
        await createVehicle(payload);
        showToast("success", "Vehicle added", `${plateNumber} joined the fleet.`);
      }
      setModalOpen(false);
      loadVehicles();
    } catch (err) {
      showToast("error", "Save failed", err.response?.data?.error || "Failed to save vehicle.");
    } finally {
      setSubmitting(false);
    }
  }

  const columns = [
    {
      key: "plateNumber",
      header: "Plate number",
      width: 160,
      sortable: true,
      render: (vehicle) => <span className="cell-mono cell-plate">{vehicle.plateNumber}</span>,
    },
    {
      key: "model",
      header: "Model",
      sortable: true,
      render: (vehicle) => vehicle.model || <span className="cell-muted">—</span>,
    },
    {
      key: "capacity",
      header: "Capacity",
      width: 130,
      numeric: true,
      sortable: true,
      hideBelow: "md",
      render: (vehicle) =>
        vehicle.capacity != null ? (
          <>
            {vehicle.capacity.toLocaleString()} <span className="cell-unit">kg</span>
          </>
        ) : (
          <span className="cell-muted">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: 150,
      sortable: true,
      render: (vehicle) => (
        <Badge variant={getVehicleStatusVariant(vehicle.status)} dot>
          {getVehicleStatusLabel(vehicle.status)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: 90,
      align: "end",
      render: (vehicle) => (
        <div className="cell-actions">
          <button
            className="trip-view-btn"
            type="button"
            onClick={() => openEditModal(vehicle)}
            aria-label={`Edit ${vehicle.plateNumber}`}
          >
            Edit
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Fleet inventory, load capacity and availability"
        actions={
          <Button variant="primary" onClick={openAddModal}>
            <PlusCircleIcon size={16} />
            <span>Add vehicle</span>
          </Button>
        }
      />

      <FilterBar
        search={
          <SearchBar
            label="Search vehicles"
            placeholder="Plate number or model…"
            onChange={setSearch}
          />
        }
        filters={
          <FilterTabs
            tabs={VEHICLE_FILTER_TABS}
            active={filter}
            counts={counts}
            onChange={setFilter}
          />
        }
        activeFilters={[
          ...(filter !== "All"
            ? [{ key: "status", label: "Status", value: filter, onRemove: () => setFilter("All") }]
            : []),
          ...(search
            ? [{ key: "q", label: "Search", value: `“${search}”`, onRemove: () => setSearch("") }]
            : []),
        ]}
        onClearAll={isFiltered ? clearFilters : undefined}
        resultCount={loading ? undefined : filteredVehicles.length}
        totalCount={vehicles.length}
      />

      <DataTable
        label="Vehicles"
        caption="Fleet vehicles with plate number, model, capacity and status"
        columns={columns}
        rows={filteredVehicles}
        rowKey={(vehicle) => vehicle.id}
        loading={loading}
        error={error}
        onRetry={loadVehicles}
        empty={
          isFiltered
            ? {
                variant: "filtered",
                title: "No vehicles match these filters",
                subtitle: "Try a different status, or clear the search.",
                action: { label: "Clear filters", onClick: clearFilters },
              }
            : {
                illustration: EmptyVehiclesIllustration,
                title: "No vehicles in the fleet",
                subtitle: "Add a vehicle before dispatching trips against it.",
                action: { label: "Add vehicle", onClick: openAddModal },
              }
        }
        sort={sort}
        onSortChange={setSort}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingVehicle ? "Edit vehicle" : "Add vehicle"}
        size="sm"
      >
        <form ref={formRef} className="dispatch-form" onSubmit={handleSubmit} noValidate>
          <FormField
            label="Plate number"
            htmlFor="vehicle-plate"
            required
            error={vehicleForm.errors.plateNumber}
          >
            {(field) => (
              <input
                {...field}
                value={vehicleForm.values.plateNumber}
                onChange={(e) => vehicleForm.setValue("plateNumber", e.target.value)}
                onBlur={() => vehicleForm.handleBlur("plateNumber")}
              />
            )}
          </FormField>

          <FormField label="Model" htmlFor="vehicle-model" hint="Optional.">
            {(field) => (
              <input
                {...field}
                value={vehicleForm.values.model}
                onChange={(e) => vehicleForm.setValue("model", e.target.value)}
              />
            )}
          </FormField>

          <FormField
            label="Capacity"
            htmlFor="vehicle-capacity"
            required
            hint="Maximum payload this vehicle can carry."
            error={vehicleForm.errors.capacity}
          >
            {(field) => (
              <div className="input-with-unit">
                <input
                  {...field}
                  type="number"
                  min="1"
                  value={vehicleForm.values.capacity}
                  onChange={(e) => vehicleForm.setValue("capacity", e.target.value)}
                  onBlur={() => vehicleForm.handleBlur("capacity")}
                />
                <span className="input-unit-label">kg</span>
              </div>
            )}
          </FormField>

          <Button type="submit" variant="primary" loading={submitting} className="modal-submit-btn">
            {editingVehicle ? "Save changes" : "Add vehicle"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
