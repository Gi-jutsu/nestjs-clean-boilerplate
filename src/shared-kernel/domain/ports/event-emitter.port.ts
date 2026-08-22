import type { BrandedInjectionToken } from "@packages/nest-provider-factory";

export interface EventEmitter {
  emit(event: string, ...values: any[]): void;
  emitAsync(event: string, ...values: any[]): Promise<any[]>;
}

export const EventEmitterToken = Symbol(
  "EventEmitter",
) as BrandedInjectionToken<EventEmitter>;
