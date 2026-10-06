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

2.1. Start PostgreSQL using [docker-compose.yaml](/docker/docker-compose.yaml)

```shell
docker compose -f docker/docker-compose.yaml up database -d
```

2.2. Run the SQL migrations

```shell
pnpm drizzle-kit migrate
```

### 3. Start the API

You can run the backend either **locally** or **with Docker**.

#### Option A: Run locally (watch mode)

```shell
pnpm dev
```

#### Otpion B: Run with Docker

```shell
docker compose -f docker/docker-compose.yaml up api -d
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
schema. Authentication and the outbox use this same database and connection pool.
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

The test runner applies migrations to that database. Test applications use
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

### 🪪 Authentication

Authentication uses `@nestjs/authentication` for password hashing, session cookies,
expiry, rotation, CSRF protection and the global authentication guard. Users and
credentials remain in the existing PostgreSQL `user` and `account` tables;
`authentication_session` stores only session token hashes.

The email/password routes retain their paths:

| Method | Path                      | Response                                                          |
| ------ | ------------------------- | ----------------------------------------------------------------- |
| POST   | `/api/auth/sign-up/email` | `{ user, token: null }` and a session cookie                      |
| POST   | `/api/auth/sign-in/email` | `{ user, redirect: false, token: null }` and a session cookie     |
| GET    | `/api/auth/get-session`   | `{ user, session }`, or JSON `null` when anonymous                |
| POST   | `/api/auth/sign-out`      | `{ success: true }`, revoking the session and clearing its cookie |

Sign-up accepts `name`, `email` and a password of 8–128 characters. Sign-in accepts
`email` and `password`. Routes require authentication unless marked with the
official `@Public()` decorator. Sessions expire after seven days, or one day of
inactivity. The raw session token travels only in an `HttpOnly`, `SameSite=Lax`
cookie; API responses omit it.

Clients should make cookie-based HTTP requests, using `credentials: "include"`
where needed. This is not a drop-in replacement for the Better Auth SDK: its
additional endpoints, `rememberMe` and callback options are not implemented.
Existing session cookies require a fresh sign-in. Existing Better Auth password
hashes still verify, including their Unicode normalization, and successful
sign-ins upgrade them to the native format without changing the user record.
Deploy this change with a coordinated cutover: older Better Auth instances cannot
verify upgraded hashes, and a rollback needs a compatible password verifier.
Legacy session and verification tables remain intact.

Set `API_BASE_URL` to the public API origin, independently of the HTTP bind
address. The Docker example uses `http://localhost:8080` while listening on
`0.0.0.0`. Set `AUTH_COOKIE_SECURE=true` behind HTTPS; it defaults to `true`. The supplied
local HTTP examples set it to `false`. Add any separate frontend origins to the
comma-separated `AUTH_TRUSTED_ORIGINS` setting; `API_BASE_URL` is already trusted.
MFA and refresh tokens are disabled through explicit stores that reject writes.
Enabling either feature requires replacing its disabled store with persistent
storage and adding its own endpoints and tests.

### 📬 Outbox Pattern

- [NestJS transactional outbox](https://docs.nestjs.com/reliability/outbox) owns PostgreSQL storage, polling, retries, dead letters, leases, and consumer inboxes.
- Pass the current Drizzle transaction to `DomainEventPublisher.publish(aggregate, transaction)`. Aggregate changes and their events commit or roll back together; the relay only sees committed rows.
- `@OnOutboxMessage(topic, { consumer })` discovers consumers. Give each consumer a stable name and use `context.processInTransaction(transaction, work)` when its effects belong to the same database.
- Delivery is at least once. Consumers that call external services must use those services' idempotency support. Messages from the same aggregate are delivered in insertion order.
- Run `pnpm drizzle-kit migrate` before starting the application, including production deployments. The migration creates the package-owned `nest_outbox` schema; application startup checks it without changing it.

For an existing installation, follow the [outbox migration instructions](docs/outbox-migration.md) before deploying this version.

### 🐳 Docker-Ready

- <b>Optimized for Deployments</b>: Multi-stage build keeps the production image lean, reducing network footprint and speeding up deployments.

- <b>Run Locally:</b> Launch the entire stack (API + Database) with [docker-compose.yaml](/docker/docker-compose.yaml)

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
