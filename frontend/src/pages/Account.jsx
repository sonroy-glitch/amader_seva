import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useLang } from "../lib/i18n.jsx";

// Change name and phone. Password is changed with "Forgot password".
export default function Account() {
  const { user, updateUser } = useAuth();
  const { t } = useLang();
  const [form, setForm] = useState({ name: user.name, phone: user.phone });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm({ ...form, [field]: value });
    setMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError("Name must be at least 2 characters");
    if (!/^[6-9]\d{9}$/.test(form.phone)) return setError("Enter a valid 10 digit mobile number");
    setError("");
    setSaving(true);
    try {
      const data = await api("/auth/me", { method: "PUT", body: form });
      updateUser(data.user);
      setMessage("Saved");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-page max-w-xl pt-10 sm:pt-14">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t("Account settings")}</h1>

      <form onSubmit={handleSubmit} className="card mt-8 grid gap-5 p-6 sm:p-8" noValidate>
        <div>
          <label htmlFor="name" className="label">
            {t("Full name")}
          </label>
          <input id="name" autoComplete="name" className="input" value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div>
          <label htmlFor="phone" className="label">
            {t("Mobile number")}
          </label>
          <div className="flex">
            <span className="flex items-center rounded-l-lg border border-r-0 border-line bg-sand px-3 text-[15px] text-muted">
              +91
            </span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              className="input rounded-l-none"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <div>
          <p className="label">{t("Email")}</p>
          <p className="break-all text-[15px]">{user.email}</p>
          <p className="mt-1.5 text-xs text-muted">{t("Email can't be changed.")}</p>
        </div>

        <Alert>{error}</Alert>
        {message && <Alert tone="success">{message}</Alert>}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t("Saving") : t("Save changes")}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {t("Want a new password?")}{" "}
        <Link to="/forgot-password" className="font-semibold text-green hover:underline">
          {t("Reset it with an email code")}
        </Link>
      </p>
    </div>
  );
}
