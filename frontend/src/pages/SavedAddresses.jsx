import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Loading } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useLang } from "../lib/i18n.jsx";

// Addresses the customer has booked for. They are saved on booking and picked on the next one.
export default function SavedAddresses() {
  const { t } = useLang();
  const [addresses, setAddresses] = useState(null);
  const [error, setError] = useState("");

  function load() {
    api("/addresses")
      .then((data) => setAddresses(data.addresses))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function remove(id) {
    setError("");
    try {
      await api(`/addresses/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="container-page max-w-3xl pt-10 sm:pt-14">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t("Saved addresses")}</h1>
      <p className="mt-2 text-muted">{t("Addresses you book for are saved here, so you can pick one next time.")}</p>

      <div className="mt-8">
        <Alert>{error}</Alert>
        {!addresses && !error && <Loading />}

        {addresses && addresses.length === 0 && (
          <div className="card p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">{t("No saved addresses yet")}</h2>
            <p className="mt-2 text-muted">{t("When you book a service, the address you give is saved here.")}</p>
            <Link to="/" className="btn-primary mt-6">
              {t("Find help")}
            </Link>
          </div>
        )}

        {addresses && addresses.length > 0 && (
          <ul className="grid gap-3">
            {addresses.map((a) => (
              <li key={a.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-[15px]">
                  <p className="font-semibold">{a.house}</p>
                  <p>{a.area}</p>
                  {a.landmark && <p className="text-muted">{t("Landmark")}: {a.landmark}</p>}
                  <p className="text-muted">
                    {a.city} - {a.pincode}
                  </p>
                </div>
                <button onClick={() => remove(a.id)} className="btn-outline self-start">
                  {t("Remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
