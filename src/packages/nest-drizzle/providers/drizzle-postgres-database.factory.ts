import { Inject, Injectable } from "@nestjs/common";
import {
  type DrizzleModuleOptions,
  MODULE_OPTIONS_TOKEN,
} from "@packages/nest-drizzle/nest-drizzle-module.definition.js";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

@Injectable()
export class DrizzlePostgresDatabaseFactory {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: DrizzleModuleOptions,
  ) {}

  createDatabase() {
    const postgresPool = this.createPostgresPool();

    return drizzle(postgresPool, { schema: this.options.schema });
  }

  private createPostgresPool() {
    return new pg.Pool({
      connectionString: this.options.connectionString,
    });
  }
}
