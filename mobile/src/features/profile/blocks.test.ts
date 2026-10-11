import i18n from "@/i18n";
import { BLOCK_DEFS } from "@taptap/core/blocks";
import { actionGroups, actionKeyboard, actionLabel, actionProblem } from "./blocks";
import { whatsAppShareUrl } from "./share";

const t = i18n.t.bind(i18n);

describe("action wording", () => {
  it("has a name, description, field and example for every action type the web offers", () => {
    for (const def of BLOCK_DEFS) {
      for (const part of ["label", "description", "placeholder", "field"] as const) {
        const key = `blocks.${def.type}.${part}`;
        expect({ key, exists: i18n.exists(key) }).toEqual({ key, exists: true });
        // The contact card has no value, so no field or example to show.
        if (def.needsValue) expect(t(key as never)).not.toBe("");
      }
    }
  });

  it("names an action type this app does not know without crashing", () => {
    expect(actionLabel(t, "spotify")).toBe("Action");
    expect(actionLabel(t, "whatsapp")).toBe("WhatsApp");
  });

  it("groups every type once, Kenya-first", () => {
    const groups = actionGroups(t);
    expect(groups[0]).toEqual({
      title: "Popular in Kenya",
      types: ["whatsapp", "google_review", "mpesa", "directions"],
    });
    expect(groups.flatMap((g) => g.types).sort()).toEqual(BLOCK_DEFS.map((d) => d.type).sort());
  });

  it("opens the right keyboard", () => {
    expect(actionKeyboard("whatsapp")).toBe("phone-pad");
    expect(actionKeyboard("email")).toBe("email-address");
    expect(actionKeyboard("website")).toBe("url");
    expect(actionKeyboard("mpesa")).toBe("default");
  });
});

describe("actionProblem", () => {
  it("requires a value for actions that open something", () => {
    expect(actionProblem("website", "  ")).toBe("editor.action.valueMissing");
    expect(actionProblem("contact", "")).toBeNull();
  });

  it("holds WhatsApp and Call to a number that can be dialled", () => {
    expect(actionProblem("whatsapp", "0722 000 000")).toBeNull();
    expect(actionProblem("call", "+254 722 000 000")).toBeNull();
    expect(actionProblem("whatsapp", "0722 000")).toBe("editor.action.phoneShort");
    expect(actionProblem("whatsapp", "07220000000")).toBe("editor.action.phoneLong");
    expect(actionProblem("call", "call me")).toBe("editor.action.phoneInvalid");
  });

  it("refuses links and emails that would be dead buttons, as the server does", () => {
    expect(actionProblem("website", "mamanjeri.co.ke")).toBeNull();
    expect(actionProblem("website", "mama njeri")).toBe("editor.action.valueInvalid");
    expect(actionProblem("email", "hello@mamanjeri")).toBe("editor.action.valueInvalid");
    expect(actionProblem("directions", "Westlands, Nairobi")).toBeNull();
    expect(actionProblem("mpesa", "Till 123456")).toBeNull();
  });

  it("has words for every problem it can report", () => {
    for (const key of [
      "editor.action.valueMissing",
      "editor.action.valueInvalid",
      "editor.action.phoneInvalid",
      "editor.action.phoneShort",
      "editor.action.phoneLong",
    ]) {
      expect(i18n.exists(key)).toBe(true);
    }
  });
});

describe("sharing", () => {
  it("fills WhatsApp's message, escaped", () => {
    expect(whatsAppShareUrl("Mama Njeri's: https://x.co/a?b=1&c=2")).toBe(
      "https://wa.me/?text=Mama%20Njeri's%3A%20https%3A%2F%2Fx.co%2Fa%3Fb%3D1%26c%3D2",
    );
  });
});
