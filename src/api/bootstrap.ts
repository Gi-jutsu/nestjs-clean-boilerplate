import { ApplicationModule } from "@api/application.module.js";
import { configureHttpApplication } from "@api/configure-http-application.js";
import { ApiEnvironmentKeys } from "@api/environment.js";
import { createHttpApplicationOptions } from "@api/http-application-options.js";
import { Logger } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

export async function bootstrap() {
  await ConfigModule.envVariablesLoaded;
  const logger = new Logger("bootstrap");

  const application = await NestFactory.create(
    ApplicationModule,
    createHttpApplicationOptions(),
  );

  application.enableShutdownHooks();
  configureHttpApplication(application);

  const config = application.get(ConfigService);
  const host = config.getOrThrow(ApiEnvironmentKeys.API_HTTP_HOST);
  const port = config.getOrThrow(ApiEnvironmentKeys.API_HTTP_PORT);
  const scheme = config.getOrThrow(ApiEnvironmentKeys.API_HTTP_SCHEME);
  const url = `${scheme}://${host}:${port}`;

  await application.listen(port, host, () =>
    logger.log(`🚀 API is running on ${url}`),
  );

  // Ensure uncaught exceptions do not crash the application
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
  });

  return application.getHttpServer();
}
