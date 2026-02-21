// Application status constants
export const APPLICATION_STATUSES = {
  PENDING: "pending",
  NEEDS_INFO: "needs_info",
  SUPPLEMENTAL_SUBMITTED: "supplemental_submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  DECLINED: "declined",
  DECISION_UPLOADED: "DECISION_UPLOADED",
  ISSUED: "ISSUED",
  PERMIT_ISSUED: "PERMIT_ISSUED",
  GRANTED: "GRANTED",
} as const;

// Decision status constants
export const DECISION_STATUSES = {
  REQUEST_INFO: "REQUEST_INFO",
  APPROVED: "APPROVED",
  GRANTED: "GRANTED",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  REJECTED: "REJECTED",
} as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[keyof typeof APPLICATION_STATUSES];
export type DecisionStatus = (typeof DECISION_STATUSES)[keyof typeof DECISION_STATUSES];
