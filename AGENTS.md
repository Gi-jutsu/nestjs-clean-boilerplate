# NestJS Clean Boilerplate

Welcome to the NestJS Boilerplate. This project provides a solid foundation for building scalable and maintainable backend applications with NestJS, following the [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html). It also integrates concepts from [Domain-Driven Design (DDD)](https://martinfowler.com/bliki/DomainDrivenDesign.html) to help organize your code around the core business logic.

## Features

- [x] 🪪 Authentication | with [better-auth](https://www.better-auth.com/)
- [x] 📬 Outbox Pattern
- [x] 🐳 Docker-Ready

## Validating Changes

To validate your changes you can run the following commands:

```bash
pnpm test            # Run all tests (e2e, integration, unit)
pnpm build           # Build the modulithe
```

## Guidelines

1. **Always check existing patterns** before implementing new features
2. **Maintain type safety** - this is a TypeScript-first codebase
3. **Test your changes** - ensure all tests pass before committing
