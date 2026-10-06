import {
  ObserveEnabledSchema,
  EnabledObserveEnvironmentSchema,
} from "@api/observability/environment.js";
import { getOrCreateCorrelationId } from "@api/middlewares/correlation-id.middleware.js";
import { ConditionalModule, ConfigModule, ConfigService } from "@nestjs/config";
import { createObserveModule, defaultTraceIdGenerator } from "@nestjs/observe";
import type { IncomingHttpHeaders } from "node:http";

const { ObserveModule, ObserveInstrument } = createObserveModule({
  attachTraceIdToLogs: true,
  sourceContext: false,
  traceIdGenerator: (request: unknown) => {
    if (hasHttpHeaders(request))
      return getOrCreateCorrelationId(request.headers);
    return defaultTraceIdGenerator(request);
  },
});

export { ObserveInstrument };

export function isObserveEnabled() {
  return ObserveEnabledSchema.parse(process.env.OBSERVE_ENABLED) === "true";
}

export function createObserveImports(enabled?: boolean) {
  if (enabled === false) return [];

  const observeModule = ObserveModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const environment = EnabledObserveEnvironmentSchema.parse({
        OBSERVE_ENABLED: "true",
        OBSERVE_APP_KEY: config.get("OBSERVE_APP_KEY"),
        OBSERVE_APP_SECRET: config.get("OBSERVE_APP_SECRET"),
        OBSERVE_SERVICE_ID: config.get("OBSERVE_SERVICE_ID"),
        OBSERVE_ENDPOINT: config.get("OBSERVE_ENDPOINT"),
      });

      return {
        appKey: environment.OBSERVE_APP_KEY,
        appSecret: environment.OBSERVE_APP_SECRET,
        serviceId: environment.OBSERVE_SERVICE_ID,
        endpoint: environment.OBSERVE_ENDPOINT,
        forwardLogs: false,
        runtimeMetrics: true,
        http: { capture: false },
      };
    },
  });
  if (enabled === true) return [observeModule];

  return [
    ConditionalModule.registerWhen(observeModule, () => isObserveEnabled(), {
      debug: false,
    }),
  ];
}

function hasHttpHeaders(
  request: unknown,
): request is { headers: IncomingHttpHeaders } {
  return (
    typeof request === "object" &&
    request !== null &&
    "headers" in request &&
    typeof request.headers === "object" &&
    request.headers !== null
  );
}
