// ── DB enum: app_status ──────────────────────────────────────────────
export const APPLICATION_STATUSES = {
  SUBMITTED: "SUBMITTED",
  ROUTED: "ROUTED",
  CLARIFICATION_REQUESTED: "CLARIFICATION_REQUESTED",
  DECISION_UPLOADED: "DECISION_UPLOADED",
  CLOSED: "CLOSED",
} as const;

// ── DB enum: permit_status ───────────────────────────────────────────
export const PERMIT_STATUSES = {
  PENDING_GENERATION: "PENDING_GENERATION",
  GENERATED: "GENERATED",
  REVOKED: "REVOKED",
} as const;

// ── decisions.decision is free-text, but we use consistent values ────
export const DECISION_TYPES = {
  APPROVED: "APPROVED",
  DECLINED: "DECLINED",
  REQUEST_INFO: "REQUEST_INFO",
} as const;

// ── DB enum: app_role ────────────────────────────────────────────────
export const ROLES = {
  CITIZEN: "CITIZEN",
  GOVERNMENT: "GOVERNMENT",
  DEVELOPER: "DEVELOPER",
  CLERK: "CLERK",
  ADMIN: "ADMIN",
} as const;

// ── Allowed MIME types for document uploads ──────────────────────────
export const ALLOWED_DOC_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[keyof typeof APPLICATION_STATUSES];
export type PermitStatus = (typeof PERMIT_STATUSES)[keyof typeof PERMIT_STATUSES];
export type DecisionType = (typeof DECISION_TYPES)[keyof typeof DECISION_TYPES];
export type Role = (typeof ROLES)[keyof typeof ROLES];
