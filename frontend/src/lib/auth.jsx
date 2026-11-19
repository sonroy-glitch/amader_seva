// This file shares the auth context, its hook and a helper, not just components
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

function savedUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(savedUser);

  // Refresh the user from the server; log out if the token has expired
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    api("/auth/me")
      .then((data) => {
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      })
      .catch((error) => {
        if (error.status === 401 || error.status === 404) logout();
      });
  }, []);

  function login(token, user) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
  }

  // After the account settings are saved
  function updateUser(user) {
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// Where to go after login: the page they came from, or their home
export function homeFor(user, next) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  if (user.role === "ADMIN") return "/admin";
  return user.role === "PROVIDER" ? "/bookings" : "/";
}
