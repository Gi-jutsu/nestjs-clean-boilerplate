import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { ApplicationModule } from './application.module.js';
import { EnvironmentKeys } from './core/environment.js';

export async function bootstrap() {
  const logger = new Logger('bootstrap');

  const application = await NestFactory.create(ApplicationModule, { logger });
  application.enableShutdownHooks();
  application.use(cookieParser());
  application.use(helmet());
  application.useGlobalPipes(new ValidationPipe());

  const config = application.get(ConfigService);
  const host = config.getOrThrow(EnvironmentKeys.API_HTTP_HOST);
  const port = config.getOrThrow(EnvironmentKeys.API_HTTP_PORT);
  const scheme = config.getOrThrow(EnvironmentKeys.API_HTTP_SCHEME);
  const url = `${scheme}://${host}:${port}`;

  await application.listen(port, host, () =>
    logger.log(`🚀 API is running on ${url}`),
  );

  // Ensure uncaught exceptions do not crash the application
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
  });

  return application.getHttpServer();
}

// Run the application if the script is executed directly
const filename = fileURLToPath(import.meta.url);
if (process.argv[1] === filename) {
  void bootstrap();
}
