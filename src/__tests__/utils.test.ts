import { describe, expect, it } from "vitest";
import {
  deriveInboxBaseForUser,
  parseCurrencyInput,
  parseTeamRoleInput,
  parseVatThresholdInput,
} from "../utils/team-utils.js";
import { slugify } from "../utils/strings.js";

describe("team utils", () => {
  it("parses currencies", () => {
    expect(parseCurrencyInput("gbp")).toEqual({ value: "GBP" });
    expect(parseCurrencyInput("" as unknown)).toEqual({ value: null });
    expect(parseCurrencyInput(123 as unknown)).toEqual({ error: "invalid_currency" });
  });

  it("parses team roles", () => {
    expect(parseTeamRoleInput("owner")).toEqual({ value: "owner" });
    expect(parseTeamRoleInput("ADMIN")).toEqual({ value: "admin" });
    expect(parseTeamRoleInput("invalid")).toEqual({ error: "invalid_role" });
  });

  it("parses vat thresholds", () => {
    expect(parseVatThresholdInput("10")).toEqual({ value: 10 });
    expect(parseVatThresholdInput("" as unknown)).toEqual({ value: null });
    expect(parseVatThresholdInput(-1)).toEqual({ error: "invalid_vat_threshold" });
  });

  it("derives inbox base", () => {
    const user = { email: "hello@example.com", fullName: "Jane Doe", username: "jdoe" };
    expect(deriveInboxBaseForUser(user, "existing")).toBe("existing");
    expect(deriveInboxBaseForUser(user)).toBe("hello");
    expect(deriveInboxBaseForUser({ ...user, email: null })).toBe("jane.doe");
  });

  it("slugifies names", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
});
