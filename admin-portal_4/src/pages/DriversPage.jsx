import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getDrivers, deactivateDriver } from "../services/driverService";
import { getTrips } from "../services/tripService";
import { useAuthStore } from "../store/authStore";
import KpiCard from "../components/common/KpiCard";
import Modal from "../components/common/Modal";
import Button from "../components/common/Button";
import PageHeader from "../components/common/PageHeader";
import FilterBar from "../components/common/FilterBar";
import SearchBar from "../components/common/SearchBar";
import { useToast } from "../components/common/Toast";
import DriverForm from "../components/drivers/DriverForm";
import DriverTable from "../components/drivers/DriverTable";
import useCssVars from "../hooks/useCssVars";
import { UsersIcon, CheckCircleIcon, TruckIcon, PlusCircleIcon } from "../components/common/Icons";

const PAGE_SIZE = 12;
const KPI_TOKENS = ["--color-primary", "--success-500", "--warning-500"];

export default function DriversPage() {
  const role = useAuthStore((state) => state.role);
  const showToast = useToast();
  const c = useCssVars(KPI_TOKENS);

  const [drivers, setDrivers] = useState([]);
  const [onDutyCount, setOnDutyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const loadDrivers = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getDrivers(), getTrips()])
      .then(([driverData, trips]) => {
        setDrivers(driverData);
        const onDutyIds = new Set(
          trips
            .filter((trip) => trip.status === "STARTED" || trip.status === "EN_ROUTE")
            .map((trip) => trip.driverId),
        );
        setOnDutyCount(onDutyIds.size);
      })
      .catch(() =>
        setError({
          title: "Can't load drivers",
          message: "The driver list is unavailable — this is a connection problem, not an empty roster.",
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredDrivers = useMemo(() => {
    const query = search.toLowerCase();
    if (!query) return drivers;
    return drivers.filter(
      (driver) =>
        driver.fullName?.toLowerCase().includes(query) ||
        driver.licenceNo?.toLowerCase().includes(query) ||
        driver.phone?.toLowerCase().includes(query),
    );
  }, [drivers, search]);

  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter((driver) => driver.isActive).length;
  const dash = "—";

  function handleAddComplete() {
    setAddModalOpen(false);
    showToast("success", "Driver added", "The driver can now be assigned to trips.");
    loadDrivers();
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await deactivateDriver(deactivateTarget.id);
      showToast(
        "success",
        "Driver deactivated",
        `${deactivateTarget.fullName} can no longer be assigned to trips.`,
      );
      loadDrivers();
      setDeactivateTarget(null);
    } catch {
      showToast("error", "Deactivation failed", "The driver was not deactivated. Please try again.");
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle="Registered drivers, their licences and current duty status"
        actions={
          <Button variant="primary" onClick={() => setAddModalOpen(true)}>
            <PlusCircleIcon size={16} />
            <span>Add driver</span>
          </Button>
        }
      />

      {/* Accents come from resolved tokens rather than the raw #3B82F6 / #06B6D4
          / #F59E0B these cards used to pass, which never changed with the theme
          and matched nothing else in the portal. */}
      <div className="stats-row stats-row-3">
        <KpiCard
          className="stagger-child"
          label="Total drivers"
          value={loading ? dash : totalDrivers}
          sub="On the roster"
          icon={UsersIcon}
          accent={c["color-primary"]}
        />
        <KpiCard
          className="stagger-child"
          label="Active drivers"
          value={loading ? dash : activeDrivers}
          sub={totalDrivers ? `of ${totalDrivers} registered` : "None registered yet"}
          icon={CheckCircleIcon}
          accent={c["success-500"]}
        />
        <KpiCard
          className="stagger-child"
          label="On duty now"
          value={loading ? dash : onDutyCount}
          sub="Currently running a trip"
          icon={TruckIcon}
          accent={c["warning-500"]}
        />
      </div>

      <FilterBar
        search={
          <SearchBar
            label="Search drivers"
            placeholder="Name, licence or phone…"
            onChange={setSearch}
          />
        }
        activeFilters={
          search ? [{ key: "q", label: "Search", value: `“${search}”`, onRemove: () => setSearch("") }] : []
        }
        onClearAll={search ? () => setSearch("") : undefined}
        resultCount={loading ? undefined : filteredDrivers.length}
        totalCount={drivers.length}
      />

      <DriverTable
        drivers={filteredDrivers}
        canDeactivate={role === "SUPER_ADMIN"}
        onDeactivate={(driver) => setDeactivateTarget(driver)}
        loading={loading}
        error={error}
        onRetry={loadDrivers}
        onAdd={() => setAddModalOpen(true)}
        isFiltered={Boolean(search)}
        onClearFilters={() => setSearch("")}
        sort={sort}
        onSortChange={setSort}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add driver" size="md">
        <DriverForm
          onComplete={handleAddComplete}
          onError={(message) => showToast("error", "Couldn't add driver", message)}
        />
      </Modal>

      <Modal
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate this driver?"
        size="sm"
      >
        <p className="confirm-dialog-text">
          {deactivateTarget?.fullName} will no longer appear when assigning trips. Trips already
          assigned to them are not affected.
        </p>
        <div className="confirm-dialog-actions">
          <Button variant="secondary" size="sm" onClick={() => setDeactivateTarget(null)} disabled={deactivating}>
            Keep active
          </Button>
          <Button variant="danger" size="sm" onClick={confirmDeactivate} loading={deactivating}>
            Deactivate
          </Button>
        </div>
      </Modal>
    </div>
  );
}
