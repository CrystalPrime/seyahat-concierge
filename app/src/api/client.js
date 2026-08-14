import { Platform } from "react-native";

// Defaults to same-machine addresses. When running the app on a physical
// phone via Expo Go, set EXPO_PUBLIC_API_URL in app/.env to your computer's
// LAN IP (e.g. http://192.168.1.20:4000) so the phone can reach the backend.
function defaultBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === "android") return "http://10.0.2.2:4000";
  return "http://localhost:4000";
}

const BASE_URL = defaultBaseUrl();

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `İstek başarısız oldu (${res.status})`);
  }
  return data;
}

export const api = {
  getDestinations: (season) => request(`/api/destinations${season ? `?season=${season}` : ""}`),
  getDestination: (id) => request(`/api/destinations/${id}`),
  searchConcierge: (text, chipFilters, history) =>
    request("/api/concierge/search", {
      method: "POST",
      body: JSON.stringify({ text, chipFilters, history }),
    }),
  getConciergeSuggestions: () => request("/api/concierge/suggestions"),
  getTrips: (status) => request(`/api/trips${status ? `?status=${status}` : ""}`),
  getTrip: (id) => request(`/api/trips/${id}`),
  createTrip: (trip) => request("/api/trips", { method: "POST", body: JSON.stringify(trip) }),
  updateTrip: (id, patch) => request(`/api/trips/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTrip: (id) => request(`/api/trips/${id}`, { method: "DELETE" }),
};

export { BASE_URL };
