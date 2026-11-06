import { describe, expect, it } from "vitest";
import { findDetails, spokenToDigits } from "@/lib/capture/patterns";

const kinds = (c: ReturnType<typeof findDetails>) => c.map((x) => `${x.kind}:${x.value}`).sort();

describe("spokenToDigits", () => {
  it("handles units, oh and tens", () => {
    expect(spokenToDigits("oh one six one, four nine six, oh seven three two")).toBe("0 1 6 1, 4 9 6, 0 7 3 2");
    expect(spokenToDigits("twenty, forty-five, seventy-seven")).toBe("20, 45, 77");
    expect(spokenToDigits("double seven triple oh")).toBe("77 000");
    expect(spokenToDigits("two oh, four five, seven seven")).toBe("2 0, 4 5, 7 7");
  });
  it("leaves ordinary words alone", () => {
    expect(spokenToDigits("Oh, I see. Is that one thing?")).toBe("oh, i see. is that 1 thing?");
  });
});

describe("findDetails with the demo script (27.3)", () => {
  it("captures the callback number in words", () => {
    const c = findDetails(["You can call me back on oh one six one, four nine six, oh seven three two."]);
    expect(kinds(c)).toEqual(["phone:+441614960732"]);
    expect(c[0].display).toBe("0161 496 0732");
  });

  it("captures the safe account and its name", () => {
    const c = findDetails([
      "The safe account is sort code twenty, forty-five, seventy-seven. Account number six three eight four, nine one two oh. Name, J Carter.",
    ]);
    const acct = c.find((x) => x.kind === "account")!;
    expect(acct.value).toBe("204577:63849120");
    expect(acct.display).toBe("20-45-77 63849120");
    expect(acct.label).toBe("J Carter");
  });

  it("captures digits as transcribed", () => {
    const c = findDetails(["Sort code 20-45-77, account 63849120. Call me on 0161 496 0732."]);
    expect(kinds(c)).toEqual(["account:204577:63849120", "phone:+441614960732"]);
  });

  it("pairs a sort code and account number split across lines", () => {
    const c = findDetails(["The sort code is two oh, four five, seven seven.", "And the account number is 63849120."]);
    expect(kinds(c)).toEqual(["account:204577:63849120"]);
  });

  it("does not merge numbers from two lines", () => {
    const c = findDetails(["My number is 0161 496 0732", "20 45 77 is the sort code"]);
    expect(kinds(c)).toEqual(["phone:+441614960732"]);
  });

  it("finds links said with dot", () => {
    const c = findDetails(["Go to natwest-secure-verify dot example and log in"]);
    expect(kinds(c)).toEqual(["url:natwest-secure-verify.example"]);
  });

  it("finds the caller name", () => {
    const c = findDetails(["Hi David. Daniel Hughes, NatWest fraud team. Your mum's account has been compromised."]);
    expect(kinds(c)).toEqual(["alias:daniel hughes"]);
  });

  it("ignores amounts", () => {
    expect(findDetails(["Move two thousand pounds now. The rest once that's cleared."])).toEqual([]);
    expect(findDetails(["Move £2,000 now."])).toEqual([]);
  });

  it("handles 14 digit runs and +44 numbers", () => {
    const c = findDetails(["20 45 77 63 84 91 20 and +44 7700 900417"]);
    expect(kinds(c)).toEqual(["account:204577:63849120", "phone:+447700900417"]);
  });
});
