export interface EventEmitter {
  emitAsync(event: string, ...values: any[]): Promise<void>;
}

export const EventEmitterToken = Symbol('EventEmitter');
