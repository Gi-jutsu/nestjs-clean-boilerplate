<div align="center">
  <h1>NestJS - Clean Architecture Boilerplate</h1>

  <p>
    <a href="./README.md" target="_blank">
      <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg">
    </a>
    <a href="./LICENSE" target="_blank">
      <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg" />
    </a>
  </p>
</div>

## 📝 Table of content

- 👋 [Introduction](#👋-introduction)
- 🚀 [Quick Start](#🚀-quick-start)
- 🌟 [Key Features](#🌟-key-features)
- 📖 [API Documentation](https://www.postman.com/lively-escape-319155/workspace/nestjs-clean-boilerplate)
- 📂 [Project Structure](#📂-project-structure)

## 👋 Introduction

Welcome to the NestJS Boilerplate. This project provides a solid foundation for building scalable and maintainable backend applications with NestJS, following the [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html). It also integrates concepts from [Domain-Driven Design (DDD)](https://martinfowler.com/bliki/DomainDrivenDesign.html) to help organize your code around the core business logic.

## 🚀 Quick Start

> [!IMPORTANT]
> To run the backend locally, you need a PostgreSQL database with migrations applied.

### 1. Clone the project

```shell
git clone git@github.com:Gi-jutsu/nestjs-clean-boilerplate.git
cd nestjs-clean-boilerplate
```

### 2. Bootstrap the PostgreSQL database

Install dependencies and configure the application first:

```shell
pnpm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to your PostgreSQL connection string.

2.1. Start PostgreSQL using [docker-compose.yaml](docker-compose.yaml)

```shell
docker compose up database -d
```

2.2. Generate your application's migration history

```shell
pnpm db:generate --name=initial
pnpm db:generate --custom --name=nest_outbox_v1
pnpm exec nest-outbox sql --from 0 --to 1 --statement-breakpoints
```

Copy the last command's SQL output into the exact new file path printed by the
custom-generation command. Review and commit the generated SQL, snapshots, and
journal in `drizzle/`, then apply them:

```shell
pnpm db:migrate
```

The boilerplate ships schema definitions and generation commands. Each application
owns its migration history. Preserve that history when adopting template updates;
generate and review subsequent migrations against your application's latest
snapshot. See [migration ownership](docs/database-migrations.md) and the
[outbox schema workflow](docs/outbox-migration.md) for existing apps and package
upgrades.

### 3. Start the API

You can run the backend either **locally** or **with Docker**.

#### Option A: Run locally (watch mode)

```shell
pnpm dev
```

#### Option B: Run with Docker

Set `DATABASE_URL` in `.env.docker` to use the Compose hostname `database`
(e.g. `postgresql://admin:password@database:5432/database`).

```shell
docker compose up nestjs-clean-boilerplate -d
```

## 🌟 Key Features

### 🩺 Health Checks

The public `GET /health-check` endpoint uses `@nestjs/terminus` to check PostgreSQL.
It returns HTTP 200 with `status: "ok"` when the database responds, or HTTP 503 with
numeric `status: 503` when it fails or the check exceeds one second. Responses use
Terminus's `info`, `error`, and `details` fields, with the database named `postgresql`.

### 🗃️ PostgreSQL with official NestJS Drizzle integration

[`@nestjs/drizzle`](https://docs.nestjs.com/data/drizzle) creates the database
through `DrizzleModule.forRootAsync()`, using `ConfigService` and the shared
schema. Better Auth and the outbox use this same database and connection pool.
NestJS closes the pool when the application shuts down.

Inject the database with the official `@InjectDrizzle()` decorator or
`getDrizzleToken()` factory token. The `SharedKernelDatabaseToken` alias preserves
the database type when registering plain classes with `createNestProvider()`.

### Testing

The API uses NestJS 12's built-in `StandardSchemaValidationPipe`. Bind Zod schemas
to request parameters with `@Body({ schema })`, `@Query({ schema })`, or
`@Param({ schema })`; the schema validates and transforms the input. Environment
validation uses the composed Zod schema through `@nestjs/config`'s
`validationSchema` option. Node.js 24 LTS is recommended.

Run `pnpm test` for unit and PostgreSQL integration coverage, and `pnpm build`
for type checking and compilation. Integration tests start PostgreSQL through
Testcontainers by default. To use an existing disposable test database, run:

```shell
TEST_DATABASE_URL=postgresql://localhost:5432/boilerplate_test pnpm test
```

The test runner prepares the current schema in that disposable database without
reading or changing your application migration files. It refuses schema changes
that may lose data. Tests protect the boilerplate's adapters, configuration,
and application policies; package internals stay covered by their maintainers.
Test applications use
`@nestjs/testing` and the production HTTP configuration, and close with
`app.close()` so Nest lifecycle hooks run. Integration scenarios use flat
`given…`, `when…`, and `then…` methods; their factory owns fixtures, HTTP requests,
and assertions.

### HTTP problem details

The global NestJS exception filter returns errors as
[`application/problem+json`](https://www.rfc-editor.org/rfc/rfc9457), including
`type`, `title`, numeric HTTP `status`, `detail`, and the request path in
`instance`. Responses include a timestamp and the correlation ID when available.
Domain resource errors map to 404 or 409; unexpected failures return a safe 500.

Explicit `HttpException` response extensions remain available. For example,
Terminus health failures keep `info`, `error`, and `details`, while their root
`status` becomes the numeric HTTP status 503. Query parameters and diagnostic
`cause` or `stack` fields are excluded from the response.

### 📬 Outbox Pattern

- [NestJS transactional outbox](https://docs.nestjs.com/reliability/outbox) owns PostgreSQL storage, polling, retries, dead letters, leases, and consumer inboxes.
- Pass the current Drizzle transaction to `DomainEventPublisher.publish(aggregate, transaction)`. Aggregate changes and their events commit or roll back together; the relay only sees committed rows.
- `@OnOutboxMessage(topic, { consumer })` discovers consumers. Give each consumer a stable name and use `context.processInTransaction(transaction, work)` when its effects belong to the same database.
- Delivery is at least once. Consumers that call external services must use those services' idempotency support. Messages from the same aggregate are delivered in insertion order.
- Generate package schema SQL with the official `nest-outbox sql` command and put it in a custom migration allocated by your application's Drizzle history. The boilerplate ships no numbered outbox migration or automatic legacy-event import.
- Run `pnpm db:migrate` before starting each release. Application startup uses `migrate: false` and checks the package-owned `nest_outbox` schema without changing it.

For an existing installation, follow the [outbox migration instructions](docs/outbox-migration.md) before deploying this version.

### 🐳 Docker-Ready

- <b>Optimized for Deployments</b>: Multi-stage build keeps the production image lean, reducing network footprint and speeding up deployments.

- <b>Run Locally:</b> Launch the entire stack (API + Database) with [docker-compose.yaml](docker-compose.yaml)

- <b>Security</b>: Runs as a non-root user to reduce security risks</b>

## 📂 Project Structure

```bash
📁 src/
├── 📁 identity-and-access/
│ ├── 📁 domain/ # Business logic (e.g. Account, ForgotPasswordRequest ...)
│ ├── 📁 infrastructure/ # Driver adapters (e.g., Jwt, Mailer, etc.)
│ ├── 📁 use-cases/ # Implements business use cases, connecting ports and domains
│ └── 📄 identity-and-access.module.ts
│
├── 📁 shared-kernel/
│ ├── 📁 domain/ # Shared logic and core domain concepts (e.g., AggregateRoot, DomainEvent, Outbox Message, Shared Errors)
│ ├── 📁 infrastructure/ # Driver adapters used across multiple bounded-contexts (e.g. GoogleCloudTasks, ...)
│ ├── 📁 use-cases/
│ ├── 📁 utils/
│ └── 📄 shared-kernel.module.ts
│
├── 📄 application.module.ts
└── 📄 main.ts
```
