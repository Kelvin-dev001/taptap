import type { resources } from "./index";

/** Typed keys: `t("foundation.title")` compiles, a typo does not. */
declare module "i18next" {
  interface CustomTypeOptions {
    resources: (typeof resources)["en"];
  }
}
