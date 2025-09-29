import { ConfigurableModuleBuilder } from "@nestjs/common";

export interface DrizzleModuleOptions {
  connectionString: string;
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<DrizzleModuleOptions>().build();
