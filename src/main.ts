import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { ApplicationModule } from './application.module.js';

export async function bootstrap() {
  const application = await NestFactory.create(ApplicationModule);
  application.use(helmet());
  application.enableShutdownHooks();
  application.use(cookieParser());
  application.useGlobalPipes(new ValidationPipe());

  const config = application.get(ConfigService);
  const host = config.getOrThrow('API_HTTP_HOST');
  const port = config.getOrThrow('API_HTTP_PORT');
  const scheme = config.getOrThrow('API_HTTP_SCHEME');
  const url = `${scheme}://${host}:${port}`;

  await application.listen(port, host, () => console.log(`🚀 API is running on ${url}`));

  return application.getHttpServer();
}

// Run the application if the script is executed directly
const filename = fileURLToPath(import.meta.url);
if (process.argv[1] === filename) {
  void bootstrap();
}
