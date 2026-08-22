import { IdentityAndAccessEnvironmentVariablesShape } from "@modules/identity-and-access/environment.js";
import { createEnvironmentKeys } from "@packages/environment-keys/index.js";
import { SharedKernelEnvironmentVariablesShape } from "@shared-kernel/environment.js";
import { z, type ZodRawShape } from "zod";

export const ApiEnvironmentVariablesShape = {
  API_BASE_URL: z.string().url().default("http://0.0.0.0:8080"),
  API_HTTP_HOST: z.string().default("0.0.0.0"),
  API_HTTP_PORT: z.string().default("8080"),
  API_HTTP_SCHEME: z.enum(["http", "https"]).default("http"),
} satisfies ZodRawShape;

export const ApiEnvironmentKeys = createEnvironmentKeys(
  ApiEnvironmentVariablesShape,
);

export const ApiEnvironmentSchema = z.object(ApiEnvironmentVariablesShape);

export const ApplicationEnvironmentSchema = z.object({
  ...ApiEnvironmentVariablesShape,
  ...IdentityAndAccessEnvironmentVariablesShape,
  ...SharedKernelEnvironmentVariablesShape,
});

export type ApiEnvironment = z.infer<typeof ApiEnvironmentSchema>;
export type ApplicationEnvironment = z.infer<
  typeof ApplicationEnvironmentSchema
>;
