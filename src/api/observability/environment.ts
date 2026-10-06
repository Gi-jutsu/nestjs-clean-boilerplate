import { z } from "zod";

export const ObserveEnabledSchema = z.enum(["false", "true"]).default("false");

export const EnabledObserveEnvironmentSchema = z.object({
  OBSERVE_ENABLED: z.literal("true"),
  OBSERVE_APP_KEY: z.string().trim().min(1),
  OBSERVE_APP_SECRET: z.string().trim().min(1),
  OBSERVE_SERVICE_ID: z.string().trim().min(1).max(100),
  OBSERVE_ENDPOINT: z
    .url()
    .refine(
      (endpoint) => ["http:", "https:"].includes(new URL(endpoint).protocol),
      "Use an HTTP or HTTPS collector endpoint",
    ),
});

export const ObserveEnvironmentSchema = z.discriminatedUnion(
  "OBSERVE_ENABLED",
  [
    z.object({
      OBSERVE_ENABLED: z.literal("false").optional().default("false"),
    }),
    EnabledObserveEnvironmentSchema,
  ],
);

export type ObserveEnvironment = z.infer<typeof ObserveEnvironmentSchema>;
