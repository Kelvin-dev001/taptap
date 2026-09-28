import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";

/**
 * Every string a person sees goes through here (PLAN.md §4.9); lint refuses
 * text written directly in a screen. v1 is English only (brief), so the
 * language is fixed rather than read from the phone. Kiswahili becomes one
 * more resource file and a change to `lng`.
 */
export const resources = { en: { translation: en } } as const;

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  // React already escapes what it renders; escaping here would double it.
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
