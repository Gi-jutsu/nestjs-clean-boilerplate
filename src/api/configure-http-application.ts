import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";

export function configureHttpApplication(application: INestApplication) {
  application.use(cookieParser());
  application.use(helmet());
  application.useGlobalPipes(new ValidationPipe());
}
