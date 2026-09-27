import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  authId: text("auth_id"),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("student"),
  status: text("status").notNull().default("invited"),
  identifierLast4: text("identifier_last4"),
  groupId: text("group_id"),
  memberRole: text("member_role").notNull().default("member"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_profiles_email").on(table.email),
  uniqueIndex("idx_profiles_auth_id").on(table.authId),
  index("idx_profiles_group").on(table.groupId),
  index("idx_profiles_status_role").on(table.status, table.role),
]);

export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  groupId: text("group_id"),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  dataJson: text("data_json").notNull().default("{}"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_records_kind_status").on(table.kind, table.status),
  index("idx_records_group_kind").on(table.groupId, table.kind),
  index("idx_records_updated").on(table.updatedAt),
]);

export const securityAudit = sqliteTable("security_audit", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  actorRole: text("actor_role").notNull(),
  action: text("action").notNull(),
  targetKind: text("target_kind"),
  targetId: text("target_id"),
  outcome: text("outcome").notNull().default("success"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_security_audit_created").on(table.createdAt),
  index("idx_security_audit_action").on(table.action, table.createdAt),
  index("idx_security_audit_actor").on(table.actorId, table.createdAt),
]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  subjectId: text("subject_id").notNull(),
  scope: text("scope").notNull(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_rate_limits_updated").on(table.updatedAt),
  index("idx_rate_limits_subject_scope").on(table.subjectId, table.scope),
]);

export const fileObjects = sqliteTable("file_objects", {
  objectKey: text("object_key").primaryKey(),
  kind: text("kind").notNull(),
  groupId: text("group_id"),
  ownerId: text("owner_id").notNull(),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_file_objects_group_kind").on(table.groupId, table.kind),
  index("idx_file_objects_owner").on(table.ownerId, table.createdAt),
  index("idx_file_objects_status").on(table.status, table.createdAt),
]);
