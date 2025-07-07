export interface EventEmitter {
  emitAsync(event: string, ...values: any[]): Promise<any[]>;
}

export const EventEmitterToken = Symbol('EventEmitter');
