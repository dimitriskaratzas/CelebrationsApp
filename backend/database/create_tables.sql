-- Celebrations Database Schema
-- Phase 1 (auth foundations) + Phase 2 (favorites sync).
-- Drop all tables for clean recreation (no production data yet).
DROP TABLE IF EXISTS "Favorites" CASCADE;
DROP TABLE IF EXISTS "PasswordResetTokens" CASCADE;
DROP TABLE IF EXISTS "RefreshTokens" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;

-- ============================================================
-- USERS (anonymous-default + email/password registration)
-- ============================================================
CREATE TABLE "Users" (
    "Id"            UUID PRIMARY KEY,
    "Email"         VARCHAR(256),                       -- NULL for anonymous users
    "PasswordHash"  TEXT,                               -- NULL for anonymous users
    "IsAnonymous"   BOOLEAN         NOT NULL DEFAULT FALSE,
    "Status"        VARCHAR(20)     NOT NULL DEFAULT 'Active',
    "CreatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "UpdatedAt"     TIMESTAMPTZ
);

-- Email is unique among non-anonymous users only. Anonymous users have NULL email
-- and PostgreSQL treats NULLs as distinct in standard unique indexes, so a
-- partial unique index gives us the right semantics.
CREATE UNIQUE INDEX "IX_Users_Email_Unique"
    ON "Users" ("Email")
    WHERE "Email" IS NOT NULL;

-- ============================================================
-- REFRESH TOKENS (rotated on every refresh; only hashes stored)
-- ============================================================
CREATE TABLE "RefreshTokens" (
    "Id"            UUID PRIMARY KEY,
    "UserId"        UUID            NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "TokenHash"     TEXT            NOT NULL,
    "ExpiresAt"     TIMESTAMPTZ     NOT NULL,
    "RevokedAt"     TIMESTAMPTZ,
    "CreatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "UpdatedAt"     TIMESTAMPTZ
);

CREATE UNIQUE INDEX "IX_RefreshTokens_TokenHash" ON "RefreshTokens" ("TokenHash");
CREATE INDEX "IX_RefreshTokens_UserId" ON "RefreshTokens" ("UserId");

-- ============================================================
-- PASSWORD RESET TOKENS (1-hour TTL, single-use, hashes only)
-- ============================================================
CREATE TABLE "PasswordResetTokens" (
    "Id"            UUID PRIMARY KEY,
    "UserId"        UUID            NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "TokenHash"     TEXT            NOT NULL,
    "ExpiresAt"     TIMESTAMPTZ     NOT NULL,
    "UsedAt"        TIMESTAMPTZ,
    "CreatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "UpdatedAt"     TIMESTAMPTZ
);

CREATE UNIQUE INDEX "IX_PasswordResetTokens_TokenHash" ON "PasswordResetTokens" ("TokenHash");
CREATE INDEX "IX_PasswordResetTokens_UserId" ON "PasswordResetTokens" ("UserId");

-- ============================================================
-- FAVORITES (sync target; client-generated UUIDs; soft-delete tombstones)
-- ============================================================
CREATE TABLE "Favorites" (
    "Id"            UUID PRIMARY KEY,
    "UserId"        UUID            NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "DisplayName"   VARCHAR(100)    NOT NULL,
    "NameDayKey"    VARCHAR(64),
    "BirthdayDate"  DATE,
    "Relationship"  VARCHAR(32),
    "CreatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "UpdatedAt"     TIMESTAMPTZ,
    "DeletedAt"     TIMESTAMPTZ
);

-- Supports incremental sync via ?since= queries (filter by user, sort by update time).
CREATE INDEX "IX_Favorites_UserId_UpdatedAt" ON "Favorites" ("UserId", "UpdatedAt");

-- Partial index for the free-tier cap check: COUNT(*) WHERE UserId = X AND DeletedAt IS NULL.
-- Only indexes live rows, keeping it small and fast.
CREATE INDEX "IX_Favorites_UserId_Live" ON "Favorites" ("UserId") WHERE "DeletedAt" IS NULL;
