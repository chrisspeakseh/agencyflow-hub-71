export const APP_NAME = "AgencyFlow";
export const DEFAULT_BRAND_COLOR = "#0f172a";
export const DATE_FORMAT = "MMM dd, yyyy";

export const TASK_STATUSES = ["Todo", "In Progress", "Internal Review", "Pending Client Review", "Done"] as const;
export const TASK_PRIORITIES = ["P1-High", "P2-Medium", "P3-Low"] as const;
export const USER_ROLES = ["admin", "manager", "staff"] as const;

export const PRIORITY_COLORS = {
  "P1-High": "destructive",
  "P2-Medium": "warning",
  "P3-Low": "muted",
} as const;

export const STATUS_COLORS = {
  "Todo": "muted",
  "In Progress": "warning",
  "Internal Review": "accent",
  "Pending Client Review": "secondary",
  "Done": "success",
} as const;
