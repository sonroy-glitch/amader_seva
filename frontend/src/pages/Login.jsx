import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Alert } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import AuthShell from "../components/AuthShell.jsx";
import { homeFor, useAuth } from "../lib/auth.jsx";
import { useLang } from "../lib/i18n.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLang();
  const [params] = useSearchParams();
  const next = params.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (user) return <Navigate to={homeFor(user, next)} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const data = await api("/auth/login", { method: "POST", body: { email, password } });
      login(data.token, data.user);
      navigate(homeFor(data.user, next), { replace: true });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const registerLink = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  return (
    <AuthShell
      title={t("Log in")}
      subtitle={t("Welcome back to Amader Seva.")}
      footer={
        <>
          {t("New here?")}{" "}
          <Link to={registerLink} className="font-semibold text-green hover:underline">
            {t("Create an account")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
        <div>
          <label htmlFor="email" className="label">
            {t("Email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="label">
              {t("Password")}
            </label>
            <Link to="/forgot-password" className="text-sm font-medium text-green hover:underline">
              {t("Forgot password?")}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Alert>{error}</Alert>
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? t("Logging in") : t("Log in")}
        </button>
      </form>
    </AuthShell>
  );
}
