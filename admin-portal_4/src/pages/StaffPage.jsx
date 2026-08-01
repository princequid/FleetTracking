import React, { useCallback, useEffect, useState } from "react";
import { peekStaff, getStaff } from "../services/staffService";
import { useAuthStore } from "../store/authStore";
import Modal from "../components/common/Modal";
import Button from "../components/common/Button";
import PageHeader from "../components/common/PageHeader";
import { useToast } from "../components/common/Toast";
import StaffForm from "../components/staff/StaffForm";
import StaffTable from "../components/staff/StaffTable";
import { PlusCircleIcon } from "../components/common/Icons";

export default function StaffPage() {
  const role = useAuthStore((state) => state.role);
  const showToast = useToast();
  // Seed from the cache synchronously so returning to this page paints the list on the
  // FIRST render instead of flashing a skeleton. Caching the fetch alone wasn't enough:
  // the cached promise resolves a microtask AFTER React has already painted the empty
  // state. `undefined` means a miss; `[]` is a real (empty) cached result.
  const [staff, setStaff] = useState(() => peekStaff() ?? []);
  const [loading, setLoading] = useState(() => peekStaff() === undefined);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const loadStaff = useCallback(() => {
    // Only show the skeleton when there is genuinely nothing to show. When cached data
    // is already on screen we revalidate silently in the background
    // (stale-while-revalidate). Flipping this on unconditionally is what still made
    // the page flash on return, even after the initial state was seeded from cache —
    // the mount effect calls this loader, which immediately overwrote that `false`.
    if (peekStaff() === undefined) setLoading(true);
    setError(null);
    getStaff()
      .then(setStaff)
      .catch(() =>
        setError({
          title: "Can't load staff accounts",
          message:
            "The account list is unavailable — this is a connection problem, not an empty directory.",
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  function handleAddComplete() {
    setAddModalOpen(false);
    showToast("success", "Account created", "The new staff member can now sign in.");
    loadStaff();
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Portal accounts and the permissions attached to them"
        actions={
          <Button variant="primary" onClick={() => setAddModalOpen(true)}>
            <PlusCircleIcon size={16} />
            <span>Add staff</span>
          </Button>
        }
      />

      <StaffTable
        staff={staff}
        loading={loading}
        error={error}
        onRetry={loadStaff}
        onAdd={() => setAddModalOpen(true)}
        sort={sort}
        onSortChange={setSort}
      />

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add staff" size="md">
        <StaffForm
          currentRole={role}
          onComplete={handleAddComplete}
          onError={(message) => showToast("error", "Couldn't create account", message)}
        />
      </Modal>
    </div>
  );
}
