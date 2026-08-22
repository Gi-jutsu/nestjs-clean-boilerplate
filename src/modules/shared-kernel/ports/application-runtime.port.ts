import type { BrandedInjectionToken } from "@packages/nest-provider-factory/index.js";

export interface ApplicationRuntimePort {
  uptime(): number;
}

export const ApplicationRuntimeToken = Symbol(
  "ApplicationRuntime",
) as BrandedInjectionToken<ApplicationRuntimePort>;
