import { describe, expect, it } from "vitest";
import { normaliseAccount, normaliseAlias, normalisePhone, normaliseUrl, normaliseWallet } from "@/lib/normalise";

describe("normalise (18.1)", () => {
  it("accounts", () => {
    expect(normaliseAccount("20-45-77", "63849120")).toMatchObject({ value: "204577:63849120", display: "20-45-77 63849120" });
    expect(normaliseAccount("204577", "3849120")?.value).toBe("204577:03849120");
    expect(normaliseAccount("2045", "63849120")).toBeNull();
  });
  it("phones", () => {
    expect(normalisePhone("07700 900417")).toEqual({ value: "+447700900417", display: "07700 900417" });
    expect(normalisePhone("+44 20 7946 0381")).toEqual({ value: "+442079460381", display: "020 7946 0381" });
    expect(normalisePhone("01614960732")).toEqual({ value: "+441614960732", display: "0161 496 0732" });
    expect(normalisePhone("0113 496 0554")?.display).toBe("0113 496 0554");
    expect(normalisePhone("01632 960123")?.display).toBe("01632 960123");
    expect(normalisePhone("12345")).toBeNull();
  });
  it("urls", () => {
    expect(normaliseUrl("https://www.Natwest-Secure-Verify.example/login?x=1")).toBe("natwest-secure-verify.example");
    expect(normaliseUrl("gov-tax-rebate.example.")).toBe("gov-tax-rebate.example");
  });
  it("wallets", () => {
    expect(normaliseWallet(" 0xDEMO4f2a ")).toBe("0xdemo4f2a");
    expect(normaliseWallet("TDEMOx9Q")).toBe("TDEMOx9Q");
  });
  it("aliases", () => {
    expect(normaliseAlias("Officer Mark Reid")).toBe("mark reid");
    expect(normaliseAlias("Mr Daniel  Hughes")).toBe("daniel hughes");
  });
});
