import { Inject, Module } from "@nestjs/common";
import { drizzle } from "drizzle-orm/better-sqlite3";
import pg from "pg";
import { DrizzlePostgresPoolToken } from "./drizzle.constants.js";
import {
  ConfigurableModuleClass,
  type DrizzleModuleOptions,
  MODULE_OPTIONS_TOKEN,
} from "./drizzle.module-definition.js";

@Module({
  providers: [
    {
      provide: DrizzlePostgresPoolToken,
      useFactory: async (options: DrizzleModuleOptions) => {
        const pool = new pg.Pool({
          connectionString: options.connectionString,
        });
        return drizzle(pool);
      },
      inject: [MODULE_OPTIONS_TOKEN],
    },
  ],
  exports: [DrizzlePostgresPoolToken],
})
export class DrizzleModule extends ConfigurableModuleClass {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private options: DrizzleModuleOptions
  ) {
    super();
  }
}