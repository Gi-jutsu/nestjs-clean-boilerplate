import { ConfigurableModuleBuilder } from "@nestjs/common";

export type DrizzleDatabaseSchema = Record<string, unknown>;

export interface DrizzleModuleOptions {
  connectionString: string;
  schema: DrizzleDatabaseSchema;
}

export const {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<DrizzleModuleOptions>().build();

export type DrizzleModuleAsyncOptions = typeof ASYNC_OPTIONS_TYPE;
