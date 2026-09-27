CREATE TABLE `file_objects` (
	`object_key` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`group_id` text,
	`owner_id` text NOT NULL,
	`original_name` text NOT NULL,
	`stored_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_file_objects_group_kind` ON `file_objects` (`group_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_file_objects_owner` ON `file_objects` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_file_objects_status` ON `file_objects` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`scope` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_updated` ON `rate_limits` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_rate_limits_subject_scope` ON `rate_limits` (`subject_id`,`scope`);--> statement-breakpoint
CREATE TABLE `security_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`actor_role` text NOT NULL,
	`action` text NOT NULL,
	`target_kind` text,
	`target_id` text,
	`outcome` text DEFAULT 'success' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_security_audit_created` ON `security_audit` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_security_audit_action` ON `security_audit` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_security_audit_actor` ON `security_audit` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TRIGGER `security_audit_no_update`
BEFORE UPDATE ON `security_audit`
BEGIN
	SELECT RAISE(ABORT, 'security_audit is append-only');
END;--> statement-breakpoint
CREATE TRIGGER `security_audit_protected_retention`
BEFORE DELETE ON `security_audit`
WHEN OLD.`created_at` >= datetime('now', '-365 days')
BEGIN
	SELECT RAISE(ABORT, 'security_audit retention period is active');
END;
