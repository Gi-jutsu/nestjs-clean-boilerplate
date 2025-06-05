import { z, ZodRawShape } from "zod";

const DEFAULT_OUTBOX_PROCESSING_INTERVAL = 60_000; // 60 seconds in milliseconds

export const shape = {
  "API_BASE_URL": z.string().url(),
  "API_HTTP_HOST": z.string(),
  "API_HTTP_PORT": z.string(),
  "API_HTTP_SCHEME": z.enum(["http", "https"]),
  "DATABASE_URL": z.string().url(),
  "JWT_SECRET": z.string(),
  "OUTBOX_PROCESSING_INTERVAL": z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_OUTBOX_PROCESSING_INTERVAL),

  // Add any additional environment variables here
  // e.g.:
  // "SOME_OTHER_ENV_VAR": z.string().optional(),
} satisfies ZodRawShape;


export const EnvironmentKeys: EnvironmentKeys = Object.keys(shape).reduce(
  (acc, key) => ({ ...acc, [key]: key }),
  {} as EnvironmentKeys
);

export const EnvironmentSchema = z
  .object(shape)
  .transform((data) => ({
    ...data,
    [EnvironmentKeys.API_BASE_URL]: buildApiBaseUrl(data),
  }));

function buildApiBaseUrl(env: z.infer<z.ZodObject<EnvironmentShape>>) {
  const host = env[EnvironmentKeys.API_HTTP_HOST];
  const port = env[EnvironmentKeys.API_HTTP_PORT];
  const scheme = env[EnvironmentKeys.API_HTTP_SCHEME];
  return `${scheme}://${host}:${port}`;
}

type EnvironmentShape = typeof shape;
type EnvironmentKeys = KeyIdentityMap<EnvironmentShape>;

export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Type that maps keys of an object to their literal string values.
 * e.g.
 * 
 * ```ts
 * type A = { 
 *   API_BASE_URL: any;
 *   API_HTTP_HOST: any;
 *   ...
 * };
 * 
 * type B = KeyIdentityMap<A>;
 * // {
 * //   API_BASE_URL: "API_BASE_URL";
 * //   API_HTTP_HOST: "API_HTTP_HOST";
 * //   ...
 * // }
 * ```
 */
type KeyIdentityMap<T> = { [K in keyof T]: K };
