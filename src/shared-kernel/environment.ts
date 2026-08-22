import { createEnvironmentKeys } from "@packages/environment-keys/index.js";
import { z, type ZodRawShape } from "zod";

export const SharedKernelEnvironmentVariablesShape = {
  DATABASE_URL: z.string().url(),
} satisfies ZodRawShape;

export const SharedKernelEnvironmentKeys = createEnvironmentKeys(
  SharedKernelEnvironmentVariablesShape,
);

export const SharedKernelEnvironmentSchema = z.object(
  SharedKernelEnvironmentVariablesShape,
);

export type SharedKernelEnvironment = z.infer<
  typeof SharedKernelEnvironmentSchema
>;
