CREATE TABLE `admin_invites` (
	`token` text PRIMARY KEY NOT NULL,
	`invited_by` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
