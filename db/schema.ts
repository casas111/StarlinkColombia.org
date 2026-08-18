import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }), reference: text("reference").notNull().unique(),
  organization: text("organization").notNull(), organizationType: text("organization_type").notNull(),
  department: text("department").notNull(), city: text("city").notNull(), location: text("location").notNull(),
  units: integer("units").notNull().default(1), useCase: text("use_case").notNull(), impact: text("impact").notNull(),
  responsibleName: text("responsible_name").notNull(), responsibleRole: text("responsible_role").notNull(),
  phone: text("phone").notNull(), email: text("email").notNull(), powerAvailable: text("power_available").notNull(),
  safeInstallation: text("safe_installation").notNull(), continuityPlan: text("continuity_plan").notNull(),
  deliveryTiming: text("delivery_timing").notNull().default("asap"), requestedDeliveryAt: text("requested_delivery_at"),
  source: text("source").notNull().default("web"), status: text("status").notNull().default("new"),
  sponsorEmail: text("sponsor_email"), sponsorName: text("sponsor_name"), adminNotes: text("admin_notes").notNull().default(""),
  operationStatus: text("operation_status").notNull().default("not_promoted"), operationPromotedAt: text("operation_promoted_at"),
  aiPriorityScore: integer("ai_priority_score"), aiPriorityLevel: text("ai_priority_level"),
  aiPriorityRationale: text("ai_priority_rationale"), aiPriorityFactors: text("ai_priority_factors"),
  aiEvaluatedAt: text("ai_evaluated_at"), aiModel: text("ai_model"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const operationPromotions = sqliteTable("operation_promotions", {
  id: integer("id").primaryKey({ autoIncrement: true }), applicationId: integer("application_id").notNull().unique(),
  reference: text("reference").notNull().unique(), payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"), promotedBy: text("promoted_by").notNull(),
  sheetRow: integer("sheet_row"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), syncedAt: text("synced_at"),
});

export const admins = sqliteTable("admins", {
  email: text("email").primaryKey(), name: text("name"), invitedBy: text("invited_by"),
  status: text("status").notNull().default("invited"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const adminInvites = sqliteTable("admin_invites", {
  token: text("token").primaryKey(), invitedBy: text("invited_by").notNull(),
  active: integer("active").notNull().default(1), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }), applicationId: integer("application_id").notNull(),
  actorEmail: text("actor_email").notNull(), action: text("action").notNull(), detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mcpAuditLogs = sqliteTable("mcp_audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorEmail: text("actor_email").notNull(),
  tokenId: text("token_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const oauthClients = sqliteTable("oauth_clients", {
  clientId: text("client_id").primaryKey(),
  clientName: text("client_name").notNull(),
  clientUri: text("client_uri"),
  redirectUris: text("redirect_uris").notNull(),
  grantTypes: text("grant_types").notNull(),
  responseTypes: text("response_types").notNull(),
  registrationKey: text("registration_key").notNull(),
  createdAt: integer("created_at").notNull(),
  lastUsedAt: integer("last_used_at"),
}, (table) => [
  index("oauth_clients_registration_idx").on(table.registrationKey, table.createdAt),
]);

export const oauthAuthorizationCodes = sqliteTable("oauth_authorization_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id").notNull(),
  adminEmail: text("admin_email").notNull(),
  adminName: text("admin_name"),
  redirectUri: text("redirect_uri").notNull(),
  scope: text("scope").notNull(),
  resource: text("resource").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("oauth_codes_client_idx").on(table.clientId),
  index("oauth_codes_expiry_idx").on(table.expiresAt),
]);

export const oauthTokens = sqliteTable("oauth_tokens", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  tokenType: text("token_type").notNull(),
  familyId: text("family_id").notNull(),
  clientId: text("client_id").notNull(),
  adminEmail: text("admin_email").notNull(),
  adminName: text("admin_name"),
  scope: text("scope").notNull(),
  resource: text("resource").notNull(),
  expiresAt: integer("expires_at").notNull(),
  consumedAt: integer("consumed_at"),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("oauth_tokens_family_idx").on(table.familyId),
  index("oauth_tokens_admin_idx").on(table.adminEmail, table.expiresAt),
  index("oauth_tokens_expiry_idx").on(table.expiresAt),
]);

export const allocations = sqliteTable("allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceRow: integer("source_row").notNull().unique(),
  institution: text("institution").notNull(), type: text("type").notNull().default(""),
  kit: text("kit").notNull().default(""), city: text("city").notNull().default(""),
  units: integer("units").notNull().default(1), terminal: text("terminal").notNull().default(""),
  logistics: text("logistics").notNull().default(""), activated: text("activated").notNull().default(""),
  agreement: text("agreement").notNull().default(""), contact: text("contact").notNull().default(""),
  terminalProvider: text("terminal_provider").notNull().default(""), finalDestination: text("final_destination").notNull().default(""),
  receivedName: text("received_name").notNull().default(""), receivedId: text("received_id").notNull().default(""),
  receivedPhone: text("received_phone").notNull().default(""), stage: text("stage").notNull().default("new"),
  sourceUpdatedAt: text("source_updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const allocationOverrides = sqliteTable("allocation_overrides", {
  sourceRow: integer("source_row").primaryKey(),
  payload: text("payload").notNull(),
  editedBy: text("edited_by").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceType: text("source_type").notNull(),
  sourceEntityType: text("source_entity_type"),
  sourceEntityId: integer("source_entity_id"),
  name: text("name").notNull(),
  units: integer("units").notNull().default(1),
  location: text("location").notNull(),
  handlerEmail: text("handler_email").notNull(),
  handlerName: text("handler_name").notNull(),
  availabilityStatus: text("availability_status").notNull().default("pending"),
  availableAt: text("available_at"),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("inventory_items_source_entity_idx").on(table.sourceEntityType, table.sourceEntityId),
  index("inventory_items_status_availability_idx").on(table.status, table.availabilityStatus),
]);

export const operationalEvidence = sqliteTable("operational_evidence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  category: text("category").notNull(),
  note: text("note").notNull().default(""),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  objectKey: text("object_key").notNull().unique(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const donationAccounts = sqliteTable("donation_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  accountReference: text("account_reference").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("active"),
  contractFileName: text("contract_file_name").notNull(),
  contractContentType: text("contract_content_type").notNull(),
  contractSizeBytes: integer("contract_size_bytes").notNull(),
  contractObjectKey: text("contract_object_key").notNull().unique(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const donationAccountAssignments = sqliteTable("donation_account_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  donationAccountId: integer("donation_account_id").notNull(),
  assignedBy: text("assigned_by").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("donation_account_assignment_entity_idx").on(table.entityType, table.entityId),
]);
