import { array, boolean, nullable, number, object, ShapeIssue, string, type Infer } from "./shape";

const Lead = object({
  id: string,
  status: string,
  repeat_count: number,
  is_new: boolean,
  note: nullable(string),
  page: nullable(object({ title: string })),
});

describe("response shapes", () => {
  it("returns the checked value, typed", () => {
    const lead: Infer<typeof Lead> = Lead(
      {
        id: "l1",
        status: "new",
        repeat_count: 0,
        is_new: true,
        note: null,
        page: { title: "Café" },
      },
      "",
    );
    expect(lead.page?.title).toBe("Café");
  });

  it("drops keys it does not name", () => {
    const out = object({ id: string })({ id: "a", secret_column: "x" }, "");
    expect(out).toEqual({ id: "a" });
  });

  it("treats a missing nullable as null", () => {
    expect(object({ note: nullable(string) })({}, "")).toEqual({ note: null });
  });

  it("names the path of the first wrong value", () => {
    const List = array(Lead);
    const bad = [
      { id: "l1", status: "new", repeat_count: 0, is_new: true, note: null, page: null },
      { id: "l2", status: "new", repeat_count: "3", is_new: true, note: null, page: null },
    ];
    expect(() => List(bad, "leads")).toThrow(new ShapeIssue("leads[1].repeat_count"));
  });

  it("refuses the wrong container", () => {
    expect(() => array(string)({}, "")).toThrow(ShapeIssue);
    expect(() => object({})([], "")).toThrow(ShapeIssue);
    expect(() => object({})(null, "")).toThrow(ShapeIssue);
  });

  it("refuses numbers that are not numbers", () => {
    expect(() => number(Number.NaN, "n")).toThrow(ShapeIssue);
    expect(() => number(Infinity, "n")).toThrow(ShapeIssue);
  });
});
