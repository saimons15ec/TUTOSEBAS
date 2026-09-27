CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`identifier_last4` text,
	`group_id` text,
	`member_role` text DEFAULT 'member' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_email` ON `profiles` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_auth_id` ON `profiles` (`auth_id`);--> statement-breakpoint
CREATE INDEX `idx_profiles_group` ON `profiles` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_profiles_status_role` ON `profiles` (`status`,`role`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`group_id` text,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_records_kind_status` ON `records` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `idx_records_group_kind` ON `records` (`group_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_records_updated` ON `records` (`updated_at`);