ALTER TABLE `applications` ADD `delivery_timing` text DEFAULT 'asap' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `requested_delivery_at` text;