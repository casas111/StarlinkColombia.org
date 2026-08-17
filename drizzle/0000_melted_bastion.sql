CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admins` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text,
	`invited_by` text,
	`status` text DEFAULT 'invited' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`organization` text NOT NULL,
	`organization_type` text NOT NULL,
	`department` text NOT NULL,
	`city` text NOT NULL,
	`location` text NOT NULL,
	`units` integer DEFAULT 1 NOT NULL,
	`use_case` text NOT NULL,
	`impact` text NOT NULL,
	`responsible_name` text NOT NULL,
	`responsible_role` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`power_available` text NOT NULL,
	`safe_installation` text NOT NULL,
	`continuity_plan` text NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`sponsor_email` text,
	`sponsor_name` text,
	`admin_notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_reference_unique` ON `applications` (`reference`);