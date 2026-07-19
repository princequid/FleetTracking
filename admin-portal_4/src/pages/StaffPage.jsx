import React, { useEffect, useState } from "react";
import { getStaff } from "../services/staffService";
import { useAuthStore } from "../store/authStore";
import Modal from "../components/common/Modal";
import Button from "../components/common/Button";
import { useToast } from "../components/common/Toast";
import StaffForm from "../components/staff/StaffForm";
import StaffTable from "../components/staff/StaffTable";
import { ShieldIcon, PlusCircleIcon } from "../components/common/Icons";

export default function StaffPage() {
  const role = useAuthStore((state) => state.role);
  const showToast = useToast();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);

  function loadStaff() {
    setLoading(true);
    setError("");
    getStaff()
      .then(setStaff)
      .catch(() => setError("Unable to load staff accounts."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStaff();
  }, []);

  function handleAddComplete() {
    setAddModalOpen(false);
    showToast("success", "Account Created", "Staff account created successfully.");
    loadStaff();
  }

  function handleFormError(message) {
    showToast("error", "Error", message);
  }

  return (
    <div>
      <div className="page-header-row">
        <h1>Staff</h1>
        <Button variant="primary" onClick={() => setAddModalOpen(true)}>
          <PlusCircleIcon size={16} />
          <span>Add Staff</span>
        </Button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="trips-table-card">
        {loading ? (
          <div className="loading-text">Loading staff…</div>
        ) : staff.length === 0 ? (
          <div className="trips-empty-state">
            <ShieldIcon size={64} className="trips-empty-icon" />
            <h2 className="trips-empty-title">No staff accounts yet</h2>
            <p className="trips-empty-subtitle">Add an admin or dispatcher to get started</p>
          </div>
        ) : (
          <StaffTable staff={staff} />
        )}
      </div>

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Staff" size="md">
        <StaffForm currentRole={role} onComplete={handleAddComplete} onError={handleFormError} />
      </Modal>
    </div>
  );
}
