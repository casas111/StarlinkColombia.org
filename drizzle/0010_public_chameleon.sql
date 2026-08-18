CREATE TABLE `oauth_authorization_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`admin_email` text NOT NULL,
	`admin_name` text,
	`redirect_uri` text NOT NULL,
	`scope` text NOT NULL,
	`resource` text NOT NULL,
	`code_challenge` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_codes_client_idx` ON `oauth_authorization_codes` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_codes_expiry_idx` ON `oauth_authorization_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`client_id` text PRIMARY KEY NOT NULL,
	`client_name` text NOT NULL,
	`client_uri` text,
	`redirect_uris` text NOT NULL,
	`grant_types` text NOT NULL,
	`response_types` text NOT NULL,
	`registration_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE INDEX `oauth_clients_registration_idx` ON `oauth_clients` (`registration_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`token_type` text NOT NULL,
	`family_id` text NOT NULL,
	`client_id` text NOT NULL,
	`admin_email` text NOT NULL,
	`admin_name` text,
	`scope` text NOT NULL,
	`resource` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_tokens_token_hash_unique` ON `oauth_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_family_idx` ON `oauth_tokens` (`family_id`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_admin_idx` ON `oauth_tokens` (`admin_email`,`expires_at`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_expiry_idx` ON `oauth_tokens` (`expires_at`);--> statement-breakpoint
PRAGMA optimize;
