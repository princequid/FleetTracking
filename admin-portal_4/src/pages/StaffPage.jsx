import React, { useCallback, useEffect, useState } from "react";
import { getStaff } from "../services/staffService";
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
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const loadStaff = useCallback(() => {
    setLoading(true);
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
