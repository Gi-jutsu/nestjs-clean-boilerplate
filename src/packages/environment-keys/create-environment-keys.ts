import type { KeyIdentityMap } from "./key-identity-map.js";

export function createEnvironmentKeys<const T extends Record<string, unknown>>(
  shape: T,
): KeyIdentityMap<T> {
  return Object.keys(shape).reduce(
    (acc, key) => ({ ...acc, [key]: key }),
    {} as KeyIdentityMap<T>,
  );
}
