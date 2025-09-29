import type { Branded } from "./branded.js";

export type BrandedInjectionToken<T> = Branded<symbol, T>;
