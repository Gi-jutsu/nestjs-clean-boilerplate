import { ApplicationModule } from "@api/application.module.js";
import { configureHttpApplication } from "@api/configure-http-application.js";
import type { ModuleMetadata, NestApplicationOptions } from "@nestjs/common";
import { Test } from "@nestjs/testing";

export async function createTestingApplication(
  metadata: ModuleMetadata = { imports: [ApplicationModule] },
  options: Pick<NestApplicationOptions, "bodyParser"> = { bodyParser: false },
) {
  const module = await Test.createTestingModule(metadata).compile();
  const application = module.createNestApplication(options);

  application.useLogger(false);
  configureHttpApplication(application);
  await application.init();

  return application;
}
