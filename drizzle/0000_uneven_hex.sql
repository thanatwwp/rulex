CREATE TABLE `rulex_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet` text NOT NULL,
	`message` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE TABLE `rulex_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`wallet` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rulex_users` (
	`wallet` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL
);
