const { isAdmin } = require("./auth");

/** Tables that store a `branch` column and must be isolated per branch for non-admins */
const BRANCH_SCOPED_TABLES = new Set([
  "customers",
  "products",
  "customer_devices",
  "invoices",
  "maintenance",
  "work_orders",
  "areas",
  "stock_movements",
  "purchases",
  "returns",
  "expenses",
  "banks",
  "bank_accounts",
  "receipt_vouchers",
  "payment_vouchers",
  "stations",
  "station_maintenance",
  "candle_types",
  "rep_inventory",
]);

function branchDisplayNameFromProfile(branchId) {
  const id = branchId != null ? String(branchId) : "1";
  const map = {
    "1": "فرع الإسكندرية",
    "2": "فرع الجيزة",
    "فرع الإسكندرية": "فرع الإسكندرية",
    "فرع الجيزة": "فرع الجيزة",
  };
  return map[id] || id || "فرع الإسكندرية";
}

function enforcedBranchName(user) {
  if (!user?.profile) return null;
  return branchDisplayNameFromProfile(user.profile.branch_id);
}

/**
 * Non-admin: strip any client `branch` eq filter and force profile branch.
 * Admin: trust client filters (UI sends active branch from TopBar).
 */
function mergeBranchScopeFilters(user, table, filters) {
  const list = Array.isArray(filters) ? [...filters] : [];
  if (!BRANCH_SCOPED_TABLES.has(table)) return list;
  if (!user) return list;
  if (isAdmin(user)) return list;

  const forced = enforcedBranchName(user);
  if (!forced) return list;

  const without = list.filter((f) => !(f && f.field === "branch" && f.operator === "eq"));
  without.push({ field: "branch", operator: "eq", value: forced });
  return without;
}

function applyBranchScopeToInsertRow(user, table, row) {
  if (!BRANCH_SCOPED_TABLES.has(table) || !row || typeof row !== "object") return row;
  if (!user || isAdmin(user)) return row;
  const forced = enforcedBranchName(user);
  if (!forced) return row;
  return { ...row, branch: forced };
}

function applyBranchScopeToUpdateValues(user, table, values) {
  if (!BRANCH_SCOPED_TABLES.has(table) || !values || typeof values !== "object") return values;
  if (!user || isAdmin(user)) return values;
  const forced = enforcedBranchName(user);
  if (!forced) return values;
  if (Object.prototype.hasOwnProperty.call(values, "branch")) {
    return { ...values, branch: forced };
  }
  return values;
}

module.exports = {
  BRANCH_SCOPED_TABLES,
  mergeBranchScopeFilters,
  applyBranchScopeToInsertRow,
  applyBranchScopeToUpdateValues,
};
