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

2.2. Generate your application's initial migration

```shell
pnpm db:generate --name=initial
```

Review and commit the generated SQL, snapshots, and journal in `drizzle/`, then
apply them:

```shell
pnpm db:migrate
```

The boilerplate ships schema definitions and generation commands. Each application
owns its migration history. Preserve that history when adopting template updates;
generate and review subsequent migrations against your application's latest
snapshot. See [migration ownership](docs/database-migrations.md) for existing apps.

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

### 🗃️ PostgreSQL with official NestJS Drizzle integration

[`@nestjs/drizzle`](https://docs.nestjs.com/data/drizzle) creates the database
through `DrizzleModule.forRootAsync()`, using `ConfigService` and the shared
schema. Better Auth and the outbox use this same database and connection pool.
NestJS closes the pool when the application shuts down.

Inject the database with the official `@InjectDrizzle()` decorator or
`getDrizzleToken()` factory token. The `SharedKernelDatabaseToken` alias preserves
the database type when registering plain classes with `createNestProvider()`.

### 📬 Outbox Pattern

- [NestJS transactional outbox](https://docs.nestjs.com/reliability/outbox) owns PostgreSQL storage, polling, retries, dead letters, leases, and consumer inboxes.
- Pass the current Drizzle transaction to `DomainEventPublisher.publish(aggregate, transaction)`. Aggregate changes and their events commit or roll back together; the relay only sees committed rows.
- `@OnOutboxMessage(topic, { consumer })` discovers consumers. Give each consumer a stable name and use `context.processInTransaction(transaction, work)` when its effects belong to the same database.
- Delivery is at least once. Consumers that call external services must use those services' idempotency support. Messages from the same aggregate are delivered in insertion order.
- Run `pnpm drizzle-kit migrate` before starting the application, including production deployments. The migration creates the package-owned `nest_outbox` schema; application startup checks it without changing it.

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
