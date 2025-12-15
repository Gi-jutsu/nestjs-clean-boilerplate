# Identity & Access

Provides authentication and access control in a lightweight, reusable way.

## Overview

- Built around [better-auth.com](https://www.better-auth.com/), using [@thallesp/nestjs-better-auth](https://github.com/ThallesP/nestjs-better-auth) to wire it into NestJS.
- Globally applies `AuthGuard`; use `@IsPublic()` to expose public routes
