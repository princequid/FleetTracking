import api from "./api";

export function getStaff() {
  return api.get("/auth/staff").then((res) => res.data);
}

export function createStaff({ email, password, role }) {
  return api.post("/auth/staff", { email, password, role }).then((res) => res.data);
}
