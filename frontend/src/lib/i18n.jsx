// This file shares the language context, its hook and helpers, not just components
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import bn from "./bn.js";
import { SLOTS } from "./format.js";

const LanguageContext = createContext(null);
const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";
const TITLE = "Amader Seva | Book trusted local help";

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(localStorage.getItem("lang") === "bn" ? "bn" : "en");

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "bn" ? bn[TITLE] : TITLE;
  }, [lang]);

  function setLang(value) {
    localStorage.setItem("lang", value);
    setLangState(value);
  }

  // Bengali digits when the page is in Bengali
  function num(value) {
    const text = String(value);
    return lang === "bn" ? text.replace(/\d/g, (d) => BENGALI_DIGITS[d]) : text;
  }

  // Translate an English text. {name} parts are filled in from vars.
  function t(text, vars = {}) {
    let out = lang === "bn" ? (bn[text] ?? text) : text;
    for (const [key, value] of Object.entries(vars)) {
      out = out.replaceAll(`{${key}}`, typeof value === "number" ? num(value) : value);
    }
    return out;
  }

  // "2026-09-27" or an ISO date from the server -> "Sun, 27 Sep" / "রবিবার, ২৭ সেপ্টেম্বর"
  function formatDate(date) {
    const d = new Date(date);
    if (lang === "bn") {
      const weekday = d.toLocaleDateString("bn-IN", { weekday: "long", timeZone: "UTC" });
      const dayMonth = d.toLocaleDateString("bn-IN", { day: "numeric", month: "long", timeZone: "UTC" });
      return `${weekday}, ${dayMonth}`;
    }
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  }

  // A time from the server -> "Thu, 1 Oct, 3:40 pm" in Indian time
  function formatDateTime(value) {
    return new Date(value).toLocaleString(lang === "bn" ? "bn-IN" : "en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatPrice(price) {
    return `₹${Number(price).toLocaleString(lang === "bn" ? "bn-IN" : "en-IN")}`;
  }

  // "₹300" for a fixed price, "₹300 - ₹900" for a range
  function formatPriceRange(min, max) {
    return max > min ? `${formatPrice(min)} - ${formatPrice(max)}` : formatPrice(min);
  }

  // "MORNING" -> "Morning, 9 am to 12 pm"
  function slotLabel(value) {
    const slot = SLOTS.find((s) => s.value === value);
    return slot ? `${t(slot.label)}, ${t(slot.time)}` : value;
  }

  function yearsLabel(years) {
    if (years === 0) return t("New to the work");
    return years === 1 ? t("1 year experience") : t("{years} years experience", { years });
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, num, formatDate, formatDateTime, formatPrice, formatPriceRange, slotLabel, yearsLabel }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
