import {
  isObserveEnabled,
  ObserveInstrument,
} from "@api/observability/observe.module.js";
import { ConsoleLogger, type NestApplicationOptions } from "@nestjs/common";

export function createHttpApplicationOptions(): NestApplicationOptions {
  return {
    bodyParser: true,
    logger: new ConsoleLogger({ json: true }),
    ...(isObserveEnabled() ? { instrument: ObserveInstrument } : {}),
  };
}
