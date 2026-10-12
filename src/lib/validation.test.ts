import { describe, expect, it } from "vitest";
import {
  isE164,
  isHttpUrl,
  jsonObjectError,
  normalizePhone,
  phoneError,
  toolNameError,
  urlError,
} from "./validation";

describe("normalizePhone", () => {
  it("strips spaces, dashes, dots and brackets", () => {
    expect(normalizePhone(" +1 (415) 555-1234 ")).toBe("+14155551234");
  });
});

describe("isE164", () => {
  it("accepts a plausible international number", () => {
    expect(isE164("+14155551234")).toBe(true);
  });

  it("rejects numbers without a plus or with a leading zero country code", () => {
    expect(isE164("14155551234")).toBe(false);
    expect(isE164("+04155551234")).toBe(false);
  });
});

describe("phoneError", () => {
  it("returns null for a valid number", () => {
    expect(phoneError("+14155551234")).toBeNull();
  });

  it("requires a number when asked to", () => {
    expect(phoneError("", { required: true })).toBe("Enter a phone number");
    expect(phoneError("", { required: false })).toBeNull();
  });

  it("explains a missing country code prefix", () => {
    expect(phoneError("4155551234")).toMatch(/Start with \+/);
  });

  it("rejects too short and too long numbers", () => {
    expect(phoneError("+123456")).toMatch(/too short/);
    expect(phoneError("+1234567890123456")).toMatch(/too long/);
  });

  it("rejects a country code starting with 0", () => {
    expect(phoneError("+04155551234")).toMatch(/country code/);
  });
});

describe("urlError", () => {
  it("accepts http and https URLs", () => {
    expect(urlError("https://example.com/docs")).toBeNull();
    expect(urlError("http://example.com")).toBeNull();
  });

  it("requires a URL by default", () => {
    expect(urlError("")).toBe("Enter the URL");
    expect(urlError("", { required: false })).toBeNull();
  });

  it("rejects non-http protocols and bare words", () => {
    expect(urlError("ftp://example.com")).toMatch(/starting with http/);
    expect(urlError("example.com")).toMatch(/starting with http/);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("toolNameError", () => {
  it("requires a name", () => {
    expect(toolNameError("  ", [])).toBe("Give the function a name");
  });

  it("rejects characters outside [a-zA-Z0-9_-]", () => {
    expect(toolNameError("my tool!", [])).toMatch(/letters, numbers/);
    expect(toolNameError("get_weather", [])).toBeNull();
  });

  it("flags duplicates case-insensitively", () => {
    expect(toolNameError("GetWeather", ["getweather"])).toMatch(/already used/);
    expect(toolNameError("getWeather", ["listFlights"])).toBeNull();
  });
});

describe("jsonObjectError", () => {
  it("treats empty input as fine (nothing to validate)", () => {
    expect(jsonObjectError("")).toBeNull();
    expect(jsonObjectError("   ")).toBeNull();
  });

  it("accepts a JSON object", () => {
    expect(jsonObjectError('{"a": 1}')).toBeNull();
  });

  it("rejects invalid JSON and non-objects", () => {
    expect(jsonObjectError("{a: 1}")).toMatch(/missing commas/);
    expect(jsonObjectError("[1, 2]")).toMatch(/JSON object/);
    expect(jsonObjectError("null")).toMatch(/JSON object/);
    expect(jsonObjectError('"just a string"')).toMatch(/JSON object/);
  });
});
