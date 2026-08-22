import { createEnvironmentKeys } from "@modules/shared-kernel/environment-keys.js";
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
