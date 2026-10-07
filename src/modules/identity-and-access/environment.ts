import { createEnvironmentKeys } from "@modules/shared-kernel/environment-keys.js";
import { z, type ZodRawShape } from "zod";

export const IdentityAndAccessEnvironmentVariablesShape = {
  AUTH_COOKIE_SECURE: z.stringbool().default(true),
  AUTH_TRUSTED_ORIGINS: z
    .string()
    .default("")
    .transform((origins) =>
      origins
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url())),
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
