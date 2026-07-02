import api from "./api";

export function registerUser({ email, password, role }) {
  return api.post("/auth/register", { email, password, role }).then((res) => res.data);
}
