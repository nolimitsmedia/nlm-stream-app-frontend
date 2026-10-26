import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || window.location.origin,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("nlm_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const organizationId = localStorage.getItem("nlm_organization_id");

  if (organizationId) {
    config.headers["x-organization-id"] = organizationId;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("nlm_token");
      localStorage.removeItem("nlm_admin");
      window.location.href = "/nlm-stream/login";
    }

    return Promise.reject(error);
  },
);

export default api;
