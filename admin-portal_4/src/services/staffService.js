import api from "./api";
import { cached, invalidate, peek } from "./listCache";

export const peekStaff = () => peek("staff");

export function getStaff(opts) {
  return cached("staff", () => api.get("/auth/staff").then((res) => res.data), opts);
}

export function createStaff({ email, password, role }) {
  return api.post("/auth/staff", { email, password, role }).then((res) => {
    invalidate("staff");
    return res.data;
  });
}
