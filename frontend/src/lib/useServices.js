import { useEffect, useState } from "react";
import { api } from "./api.js";

// The list of services (Electrician, Plumber, ...) from the backend.
// Tries once more if the first call fails, since the database can be slow to wake up.
export function useServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/services")
      .catch(() => api("/services"))
      .then((data) => setServices(data.services))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { services, loading, error };
}
