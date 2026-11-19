import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import AuthShell from "../components/AuthShell.jsx";
import { useLang } from "../lib/i18n.jsx";

export default function ForgotPassword() {
  const { t } = useLang();
  const [step, setStep] = useState("email"); // email | otp | done
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function sendOtp(e) {
    e?.preventDefault();
    setError("");
    setSaving(true);
    try {
      const data = await api("/auth/forgot-password", { method: "POST", body: { email } });
      setMessage(data.message);
      setStep("otp");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6 digit OTP from the email");
    if (newPassword.length < 8) return setError("Password must be at least 8 characters");
    setError("");
    setSaving(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: { email, otp, newPassword } });
      setStep("done");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (step === "done") {
    return (
      <AuthShell title={t("Password changed")} subtitle={t("You can now log in with your new password.")}>
        <Link to="/login" className="btn-primary w-full">
          {t("Log in")}
        </Link>
      </AuthShell>
    );
  }

  if (step === "otp") {
    return (
      <AuthShell title={t("Check your email")} subtitle={t(message)}>
        <form onSubmit={resetPassword} className="grid gap-5" noValidate>
          <div>
            <label htmlFor="otp" className="label">
              {t("6 digit OTP")}
            </label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="input text-lg tracking-[0.3em]"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
            <p className="mt-1.5 text-xs text-muted">{t("Valid for 10 minutes. Check your spam folder too.")}</p>
          </div>
          <div>
            <label htmlFor="newPassword" className="label">
              {t("New password")}
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <Alert>{error}</Alert>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? t("Changing password") : t("Change password")}
          </button>
          <button type="button" onClick={sendOtp} disabled={saving} className="btn-quiet justify-self-center">
            {t("Send a new OTP")}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("Forgot password")}
      subtitle={t("Enter the email you signed up with. We will send you an OTP to set a new password.")}
      footer={
        <Link to="/login" className="font-semibold text-green hover:underline">
          {t("Back to log in")}
        </Link>
      }
    >
      <form onSubmit={sendOtp} className="grid gap-5" noValidate>
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
        <Alert>{error}</Alert>
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? t("Sending OTP") : t("Send OTP")}
        </button>
      </form>
    </AuthShell>
  );
}
