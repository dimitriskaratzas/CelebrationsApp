# Celebrations Backend

ASP.NET Core (.NET 10) backend for the Celebrations app. Clean Architecture, manual Postgres schema (no EF migrations), JWT-based email/password auth with anonymous-default users.

## Prerequisites

- .NET 10 SDK
- PostgreSQL 14+ (locally or via Docker)

## Local setup

1. Start PostgreSQL and create the database + user:
   ```sql
   CREATE DATABASE celebrations;
   CREATE USER celebrations WITH PASSWORD 'celebrations_dev';
   GRANT ALL PRIVILEGES ON DATABASE celebrations TO celebrations;
   ```

2. Apply the schema:
   ```bash
   psql -U celebrations -d celebrations -f database/create_tables.sql
   ```

3. Configure local secrets — copy and edit:
   ```bash
   cp Api/appsettings.Development.example.json Api/appsettings.Development.json
   # then edit Api/appsettings.Development.json with real Jwt:Key (≥32 chars) and connection string
   ```

   `appsettings.Development.json` is gitignored — never commit it.

4. Run:
   ```bash
   dotnet run --project Api
   ```

5. Open Swagger at https://localhost:5001/swagger to explore endpoints.

## Testing

```bash
dotnet test
```

## Project structure

| Project | Responsibility |
|---|---|
| `Domain` | Entities, value objects, business rules. Zero external dependencies. |
| `Application` | Use cases, repository/service interfaces, DTOs. Depends on `Domain` only. |
| `Infrastructure` | EF Core, Postgres, JWT, BCrypt. Implements `Application` interfaces. |
| `Api` | Controllers, middleware, `Program.cs`. Composition root. |
| `Tests` | xUnit + Moq + EF InMemory. |

## Authentication endpoints (Plan 1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/anonymous` | none | Create anonymous user, get JWT |
| POST | `/api/auth/register` | none | Email/password registration |
| POST | `/api/auth/claim` | bearer (anonymous user) | Promote anonymous user to registered |
| POST | `/api/auth/login` | none | Email/password login |
| POST | `/api/auth/refresh` | none (refresh in body) | Rotate refresh token, get new access token |
| POST | `/api/auth/logout` | none | Revoke refresh token |
| POST | `/api/auth/forgot-password` | none | Initiate password reset |
| POST | `/api/auth/reset-password` | none | Complete password reset |

## Email service

Plan 1 ships `StubEmailService`, which **logs reset links to the console** instead of sending email. A real provider (Brevo/SendGrid) is integrated in Phase 1.1 by adding a class implementing `IEmailService` and replacing the registration in `DependencyInjection.cs`.

## Roadmap

This backend grows over multiple plans:
- **Plan 1 (this):** auth foundations
- **Plan 2:** favorites sync (CRUD + incremental sync)
- **Plan 3:** analytics events + Adapty webhooks

See `docs/superpowers/specs/2026-04-30-celebrations-design.md` for the full spec.
