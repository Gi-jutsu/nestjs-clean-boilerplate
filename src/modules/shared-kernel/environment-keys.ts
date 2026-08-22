type EnvironmentKeyMap<T extends Record<string, unknown>> = {
  [K in keyof T]: K;
};

export function createEnvironmentKeys<const T extends Record<string, unknown>>(
  shape: T,
): EnvironmentKeyMap<T> {
  return Object.keys(shape).reduce(
    (acc, key) => ({ ...acc, [key]: key }),
    {} as EnvironmentKeyMap<T>,
  );
}
