export type KeyIdentityMap<T extends Record<string, unknown>> = {
  [K in keyof T]: K;
};
