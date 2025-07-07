import { BrandedInjectionToken } from '@core/types/branded-injection-token.js';

export interface EventEmitter {
  emit(event: string, ...values: any[]): void;
  emitAsync(event: string, ...values: any[]): Promise<any[]>;
}

export const EventEmitterToken = Symbol(
  'EventEmitter',
) as BrandedInjectionToken<EventEmitter>;
