const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Calls the backend. Throws an Error with the server's message when it fails.
export async function api(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Could not reach the server. Check your internet connection and try again.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "Something went wrong");
    error.status = res.status;
    throw error;
  }
  return data;
}
