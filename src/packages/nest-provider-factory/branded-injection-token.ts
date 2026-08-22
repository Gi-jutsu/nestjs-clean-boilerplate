import type { Branded } from "@packages/branded-types/index.js";

export type BrandedInjectionToken<T> = Branded<symbol, T>;
