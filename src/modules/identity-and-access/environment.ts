import { createEnvironmentKeys } from "@packages/environment-keys/index.js";
import { z, type ZodRawShape } from "zod";

export const IdentityAndAccessEnvironmentVariablesShape = {
  BETTER_AUTH_URL: z.string().url().default("http://0.0.0.0:8080"),
  JWT_SECRET: z.string(),
} satisfies ZodRawShape;

export const IdentityAndAccessEnvironmentKeys = createEnvironmentKeys(
  IdentityAndAccessEnvironmentVariablesShape,
);

export const IdentityAndAccessEnvironmentSchema = z.object(
  IdentityAndAccessEnvironmentVariablesShape,
);

export type IdentityAndAccessEnvironment = z.infer<
  typeof IdentityAndAccessEnvironmentSchema
>;
