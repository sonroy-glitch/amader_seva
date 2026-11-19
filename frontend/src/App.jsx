import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Footer from "./components/Footer.jsx";
import Header from "./components/Header.jsx";
import { RequireAuth } from "./components/ui.jsx";
import { useAuth } from "./lib/auth.jsx";
import Account from "./pages/Account.jsx";
import Admin from "./pages/Admin.jsx";
import Book from "./pages/Book.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Home from "./pages/Home.jsx";
import { Privacy, Terms } from "./pages/Legal.jsx";
import Login from "./pages/Login.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import NotFound from "./pages/NotFound.jsx";
import ProviderDashboard from "./pages/ProviderDashboard.jsx";
import Register from "./pages/Register.jsx";
import SavedAddresses from "./pages/SavedAddresses.jsx";
import Search from "./pages/Search.jsx";

export default function App() {
  const { pathname } = useLocation();

  // Start each new page from the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1 pb-20 sm:pb-28">
        <Routes>
          <Route
            path="/"
            element={
              <NotForProviders>
                <Home />
              </NotForProviders>
            }
          />
          <Route
            path="/search"
            element={
              <NotForProviders>
                <Search />
              </NotForProviders>
            }
          />
          <Route
            path="/book"
            element={
              <RequireAuth role="CUSTOMER">
                <Book />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <Account />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings"
            element={
              <RequireAuth>
                <MyBookings />
              </RequireAuth>
            }
          />
          <Route
            path="/addresses"
            element={
              <RequireAuth role="CUSTOMER">
                <SavedAddresses />
              </RequireAuth>
            }
          />
          <Route
            path="/provider"
            element={
              <RequireAuth role="PROVIDER">
                <ProviderDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth role="ADMIN">
                <Admin />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

// Providers only give services, they can't book them. Their home is their jobs.
function NotForProviders({ children }) {
  const { user } = useAuth();
  if (user?.role === "PROVIDER") return <Navigate to="/bookings" replace />;
  return children;
}
