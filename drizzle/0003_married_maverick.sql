CREATE TABLE `operation_promotions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`reference` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`promoted_by` text NOT NULL,
	`sheet_row` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`synced_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operation_promotions_application_id_unique` ON `operation_promotions` (`application_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `operation_promotions_reference_unique` ON `operation_promotions` (`reference`);--> statement-breakpoint
ALTER TABLE `applications` ADD `operation_status` text DEFAULT 'not_promoted' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `operation_promoted_at` text;