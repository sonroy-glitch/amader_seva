import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Alert } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import AuthShell from "../components/AuthShell.jsx";
import { homeFor, useAuth } from "../lib/auth.jsx";
import { useLang } from "../lib/i18n.jsx";

const ROLES = [
  { value: "CUSTOMER", title: "I need help at home", text: "Book electricians, plumbers and more" },
  { value: "PROVIDER", title: "I do this work", text: "Get bookings from people nearby" },
];

export default function Register() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLang();
  const [params] = useSearchParams();
  const next = params.get("next");

  const [form, setForm] = useState({
    role: params.get("role") === "PROVIDER" ? "PROVIDER" : "CUSTOMER",
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  if (user) return <Navigate to={homeFor(user, next)} replace />;

  function update(field, value) {
    setForm({ ...form, [field]: value });
    // A new email needs a new code
    if (field === "email") {
      setCodeSent(false);
      setOtp("");
      setMessage("");
    }
  }

  // Step 1: email a code to check the email is real
  async function sendCode() {
    setError("");
    setSaving(true);
    try {
      const data = await api("/auth/signup-otp", { method: "POST", body: { email: form.email } });
      setCodeSent(true);
      setMessage(data.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError("Name must be at least 2 characters");
    if (!/^[6-9]\d{9}$/.test(form.phone)) return setError("Enter a valid 10 digit mobile number");
    if (form.password.length < 8) return setError("Password must be at least 8 characters");
    if (!codeSent) return sendCode();

    // Step 2: create the account with the code
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6 digit code from the email");
    setError("");
    setSaving(true);
    try {
      const data = await api("/auth/register", { method: "POST", body: { ...form, otp } });
      login(data.token, data.user);
      navigate(data.user.role === "PROVIDER" ? "/provider" : homeFor(data.user, next), { replace: true });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const loginLink = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <AuthShell
      title={t("Create your account")}
      footer={
        <>
          {t("Already have an account?")}{" "}
          <Link to={loginLink} className="font-semibold text-green hover:underline">
            {t("Log in")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
        <fieldset>
          <legend className="label">{t("I am joining because")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((role) => (
              <label
                key={role.value}
                className={`cursor-pointer rounded-lg border p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-green ${
                  form.role === role.value ? "border-green bg-green-soft" : "border-line bg-card hover:border-ink/30"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={form.role === role.value}
                  onChange={() => update("role", role.value)}
                  className="sr-only"
                />
                <span className="block text-[15px] font-semibold leading-snug">{t(role.title)}</span>
                <span className="mt-1 block text-xs text-muted">{t(role.text)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="name" className="label">
            {t("Full name")}
          </label>
          <input id="name" autoComplete="name" className="input" value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div>
          <label htmlFor="email" className="label">
            {t("Email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
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
          <p className="mt-1.5 text-xs text-muted">{t("Shared only with the person you book, after you confirm.")}</p>
        </div>
        <div>
          <label htmlFor="password" className="label">
            {t("Password")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="input"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
          <p className="mt-1.5 text-xs text-muted">{t("At least 8 characters.")}</p>
        </div>
        {codeSent && (
          <div>
            <label htmlFor="otp" className="label">
              {t("6 digit code")}
            </label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="input tracking-[0.3em]"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
            <p className="mt-1.5 text-xs text-muted">
              {t("We sent it to {email}. Check your spam folder too.", { email: form.email })}
            </p>
          </div>
        )}
        {message && !error && <Alert tone="success">{message}</Alert>}
        <Alert>{error}</Alert>
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving
            ? t("Please wait")
            : codeSent
              ? t("Create account")
              : t("Send code to my email")}
        </button>
        {codeSent && (
          <button type="button" onClick={sendCode} disabled={saving} className="btn-quiet justify-self-center">
            {t("Send a new code")}
          </button>
        )}
        <p className="text-center text-xs text-muted">
          {t("By creating an account you agree to our")}{" "}
          <Link to="/terms" className="font-semibold text-green hover:underline">
            {t("Terms")}
          </Link>{" "}
          {t("and")}{" "}
          <Link to="/privacy" className="font-semibold text-green hover:underline">
            {t("Privacy policy")}
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
