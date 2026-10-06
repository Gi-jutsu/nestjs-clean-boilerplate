import { ApplicationModule } from "@api/application.module.js";
import { configureHttpApplication } from "@api/configure-http-application.js";
import type { ModuleMetadata } from "@nestjs/common";
import { Test } from "@nestjs/testing";

export async function createTestingApplication(
  metadata: ModuleMetadata = { imports: [ApplicationModule] },
) {
  const module = await Test.createTestingModule(metadata).compile();
  const application = module.createNestApplication({ bodyParser: false });

  application.useLogger(false);
  configureHttpApplication(application);
  await application.init();

  return application;
}
