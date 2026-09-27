import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("rulex_users", {
  wallet: text("wallet").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["client", "freelancer"] }).notNull(),
  createdAt: integer("created_at").notNull(),
});

export const challenges = sqliteTable("rulex_challenges", {
  id: text("id").primaryKey(),
  wallet: text("wallet").notNull(),
  message: text("message").notNull(),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
});

export const sessions = sqliteTable("rulex_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  wallet: text("wallet").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
