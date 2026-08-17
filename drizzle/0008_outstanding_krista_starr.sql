CREATE TABLE `donation_account_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`donation_account_id` integer NOT NULL,
	`assigned_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `donation_account_assignment_entity_idx` ON `donation_account_assignments` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `donation_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`account_reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`contract_file_name` text NOT NULL,
	`contract_content_type` text NOT NULL,
	`contract_size_bytes` integer NOT NULL,
	`contract_object_key` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `donation_accounts_contract_object_key_unique` ON `donation_accounts` (`contract_object_key`);