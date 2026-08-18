CREATE TABLE `inventory_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_type` text NOT NULL,
	`source_entity_type` text,
	`source_entity_id` integer,
	`name` text NOT NULL,
	`units` integer DEFAULT 1 NOT NULL,
	`location` text NOT NULL,
	`handler_email` text NOT NULL,
	`handler_name` text NOT NULL,
	`availability_status` text DEFAULT 'pending' NOT NULL,
	`available_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_items_source_entity_idx` ON `inventory_items` (`source_entity_type`,`source_entity_id`);--> statement-breakpoint
CREATE INDEX `inventory_items_status_availability_idx` ON `inventory_items` (`status`,`availability_status`);--> statement-breakpoint
PRAGMA optimize;
