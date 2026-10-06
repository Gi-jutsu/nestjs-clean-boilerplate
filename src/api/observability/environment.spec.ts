import { ObserveEnvironmentSchema } from "@api/observability/environment.js";
import { describe, expect, it } from "vitest";

describe("ObserveEnvironmentSchema", () => {
  it("defaults to disabled without credentials", () => {
    const system = createSystemUnderTest();

    system.whenConfigurationIsValidated();

    system.thenObserveIsDisabled();
  });

  it("ignores collector settings while disabled", () => {
    const system = createSystemUnderTest();
    system.givenObserveIsDisabledWithUnusedSettings();

    system.whenConfigurationIsValidated();

    system.thenObserveIsDisabled();
  });

  it("requires credentials, service identity and endpoint when enabled", () => {
    const system = createSystemUnderTest();
    system.givenObserveIsEnabledWithoutSettings();

    system.whenConfigurationIsValidated();

    system.thenTheMissingSettingsAreRejected();
  });

  it("accepts an explicitly configured collector", () => {
    const system = createSystemUnderTest();
    system.givenObserveIsEnabledWithSettings();

    system.whenConfigurationIsValidated();

    system.thenObserveIsConfigured();
  });

  it("refuses a collector using a non-HTTP protocol", () => {
    const system = createSystemUnderTest();
    system.givenObserveIsEnabledWithSettings("ftp://collector.example");

    system.whenConfigurationIsValidated();

    system.thenConfigurationIsRejected();
  });

  it("refuses an unrecognized enable flag", () => {
    const system = createSystemUnderTest();
    system.givenAnUnrecognizedEnableFlag();

    system.whenConfigurationIsValidated();

    system.thenConfigurationIsRejected();
  });
});

function createSystemUnderTest() {
  let environment: Record<string, unknown> = {};
  let result: ReturnType<typeof ObserveEnvironmentSchema.safeParse>;

  return {
    givenObserveIsDisabledWithUnusedSettings() {
      environment = {
        OBSERVE_ENABLED: "false",
        OBSERVE_APP_KEY: "",
        OBSERVE_ENDPOINT: "unused",
      };
    },
    givenObserveIsEnabledWithoutSettings() {
      environment = { OBSERVE_ENABLED: "true" };
    },
    givenObserveIsEnabledWithSettings(endpoint = "https://collector.example") {
      environment = {
        OBSERVE_ENABLED: "true",
        OBSERVE_APP_KEY: "test-key",
        OBSERVE_APP_SECRET: "test-secret",
        OBSERVE_SERVICE_ID: "test-api",
        OBSERVE_ENDPOINT: endpoint,
      };
    },
    givenAnUnrecognizedEnableFlag() {
      environment = { OBSERVE_ENABLED: "yes" };
    },
    whenConfigurationIsValidated() {
      result = ObserveEnvironmentSchema.safeParse(environment);
    },
    thenObserveIsDisabled() {
      expect(result).toEqual({
        success: true,
        data: { OBSERVE_ENABLED: "false" },
      });
    },
    thenObserveIsConfigured() {
      expect(result).toEqual({ success: true, data: environment });
    },
    thenTheMissingSettingsAreRejected() {
      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected invalid configuration");
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
        "OBSERVE_APP_KEY",
        "OBSERVE_APP_SECRET",
        "OBSERVE_SERVICE_ID",
        "OBSERVE_ENDPOINT",
      ]);
    },
    thenConfigurationIsRejected() {
      expect(result.success).toBe(false);
    },
  };
}
