import type { Branded } from "@packages/branded-types";

export type BrandedInjectionToken<T> = Branded<symbol, T>;
