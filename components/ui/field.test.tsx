import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "./field";
import { Input, Textarea, Select } from "./input";

/**
 * These lock in the fix for UI-0 findings A1–A4 and A14: every control gets a
 * real associated label, and hints/errors reach assistive tech.
 */
describe("Field", () => {
  it("associates its label with the control", () => {
    render(
      <Field label="Business phone">
        <Input />
      </Field>,
    );
    // getByLabelText only resolves via a real label/control association.
    expect(screen.getByLabelText("Business phone")).toBeInTheDocument();
  });

  it("labels textareas and selects the same way", () => {
    render(
      <>
        <Field label="Short bio">
          <Textarea />
        </Field>
        <Field label="Point card to">
          <Select>
            <option>A page</option>
          </Select>
        </Field>
      </>,
    );
    expect(screen.getByLabelText("Short bio").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Point card to").tagName).toBe("SELECT");
  });

  it("wires a hint through aria-describedby", () => {
    render(
      <Field label="Phone" hint="We only use this to reach you">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Phone")).toHaveAccessibleDescription(
      "We only use this to reach you",
    );
  });

  it("marks the control invalid and announces the error", () => {
    render(
      <Field label="Slug" error="That name is already taken.">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Slug");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("That name is already taken.");
    expect(screen.getByRole("alert")).toHaveTextContent("That name is already taken.");
  });

  it("prefers the error over the hint when both are present", () => {
    render(
      <Field label="Slug" hint="Lowercase letters and hyphens" error="Reserved name.">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Slug")).toHaveAccessibleDescription("Reserved name.");
    expect(screen.queryByText("Lowercase letters and hyphens")).not.toBeInTheDocument();
  });

  it("propagates required to the control", () => {
    render(
      <Field label="Email" required>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText(/Email/)).toBeRequired();
  });

  it("gives each instance a unique id so repeated fields do not collide", () => {
    render(
      <>
        <Field label="First">
          <Input />
        </Field>
        <Field label="Second">
          <Input />
        </Field>
      </>,
    );
    expect(screen.getByLabelText("First").id).not.toBe(screen.getByLabelText("Second").id);
  });
});
