type ClassConstructor<T = any> = new (...args: any[]) => T;

export function createFactoryFromConstructor<T extends ClassConstructor>(constructor: T) {
  return (...args: ConstructorParameters<T>) => new constructor(...args);
}
