import { randomUUID } from 'node:crypto';

interface EntityProperties {
  id: string;
}

interface CreateEntityProperties<
  Properties extends Record<keyof Properties, unknown>,
> {
  id?: EntityProperties['id'];
  properties: Properties;
}

export abstract class Entity<
  Properties extends Record<keyof Properties, unknown>,
> {
  public readonly id: EntityProperties['id'];
  protected readonly _properties: Properties;

  constructor({ id, properties }: CreateEntityProperties<Properties>) {
    this.id = id ?? randomUUID();
    this._properties = properties;
  }

  static fromSnapshot<Constructor extends new (...args: any) => any>(
    this: Constructor,
    snapshot: InstanceType<Constructor>['_properties'] & EntityProperties,
  ): InstanceType<Constructor> {
    const { id, ...properties } = snapshot;

    return new this({ id, properties });
  }

  get properties() {
    return Object.freeze({
      id: this.id,
      ...this._properties,
    });
  }

  snapshot() {
    const snapshot = { ...this._properties, id: this.id };
    return snapshot;
  }
}
