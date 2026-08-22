import { DrizzlePostgresPoolToken } from "@api/drizzle-module/constants.js";
import {
  ConfigurableModuleClass,
  type DrizzleModuleOptions,
  MODULE_OPTIONS_TOKEN,
} from "@api/drizzle-module/module-definition.js";
import { DrizzlePostgresSchema } from "@api/drizzle-module/schema.js";
import { Inject, Module } from "@nestjs/common";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

@Module({
  providers: [
    {
      provide: DrizzlePostgresPoolToken,
      useFactory: async (options: DrizzleModuleOptions) => {
        const pool = new pg.Pool({
          connectionString: options.connectionString,
        });

        return drizzle(pool, { schema: DrizzlePostgresSchema });
      },
      inject: [MODULE_OPTIONS_TOKEN],
    },
  ],
  exports: [DrizzlePostgresPoolToken],
})
export class DrizzleModule extends ConfigurableModuleClass {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private options: DrizzleModuleOptions,
  ) {
    super();
  }
}
