CREATE TABLE `allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_row` integer NOT NULL,
	`institution` text NOT NULL,
	`type` text DEFAULT '' NOT NULL,
	`kit` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`units` integer DEFAULT 1 NOT NULL,
	`terminal` text DEFAULT '' NOT NULL,
	`logistics` text DEFAULT '' NOT NULL,
	`activated` text DEFAULT '' NOT NULL,
	`agreement` text DEFAULT '' NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`terminal_provider` text DEFAULT '' NOT NULL,
	`final_destination` text DEFAULT '' NOT NULL,
	`received_name` text DEFAULT '' NOT NULL,
	`received_id` text DEFAULT '' NOT NULL,
	`received_phone` text DEFAULT '' NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`source_updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allocations_source_row_unique` ON `allocations` (`source_row`);