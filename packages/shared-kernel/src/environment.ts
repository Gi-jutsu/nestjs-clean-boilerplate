import { ZodRawShape, z } from "zod";

export const shape = {
  API_BASE_URL: z.string().url().default("http://0.0.0.0:8080"),
  API_HTTP_HOST: z.string().default("0.0.0.0"),
  API_HTTP_PORT: z.string().default("8080"),
  API_HTTP_SCHEME: z.enum(["http", "https"]).default("http"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string(),
} satisfies ZodRawShape;

export const EnvironmentKeys: EnvironmentKeys = Object.keys(shape).reduce(
  (acc, key) => ({ ...acc, [key]: key }),
  {} as EnvironmentKeys,
);

export const EnvironmentSchema = z.object(shape);

type EnvironmentShape = typeof shape;
type EnvironmentKeys = KeyIdentityMap<EnvironmentShape>;

export type Environment = z.infer<typeof EnvironmentSchema>;

type KeyIdentityMap<T> = { [K in keyof T]: K };
