const JSON_FIELDS = {
  customer_devices: ["candles"],
  work_orders: ["items", "previous_visits"],
  maintenance: ["next_dates"],
  purchases: ["items"],
  station_maintenance: ["product_lines", "changed_candles"],
};

const DEFAULT_CANDLES = [
  { name: "الشمعة الأولى", type: "عادي درجة اولى", price: 30, duration_months: 3 },
  { name: "الشمعة الثانية", type: "عادي درجة اولى", price: 30, duration_months: 6 },
  { name: "الشمعة الثالثة", type: "عادي درجة اولى", price: 30, duration_months: 9 },
  { name: "الشمعة الرابعة", type: "عادي درجة اولى", price: 30, duration_months: 24 },
  { name: "الشمعة الخامسة", type: "عادي درجة اولى", price: 30, duration_months: 12 },
  { name: "الشمعة السادسة", type: "عادي درجة اولى", price: 30, duration_months: 24 },
  { name: "الشمعة السابعة", type: "عادي درجة اولى", price: 30, duration_months: 24 },
  { name: "الشمعة الثامنة", type: "عادي درجة اولى", price: 30, duration_months: 12 },
  { name: "الشمعة التاسعة", type: "عادي درجة اولى", price: 30, duration_months: 24 },
  { name: "الشمعة العاشرة", type: "عادي درجة اولى", price: 30, duration_months: 24 },
];

const TABLES = {
  users: {
    authRequired: false,
    select: "admin",
    insert: "admin",
    update: "admin",
    delete: "admin",
  },
  profiles: {
    authRequired: true,
    select: "auth",
    insert: "admin",
    update: "auth",
    delete: "admin",
  },
  user_roles: {
    authRequired: true,
    select: "auth",
    insert: "admin",
    update: "admin",
    delete: "admin",
  },
  customers: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  products: {
    authRequired: true,
    select: "auth",
    insert: "admin",
    update: "auth",
    delete: "admin",
  },
  customer_devices: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  candle_changes: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  installments: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  invoices: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  maintenance: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  work_orders: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  rep_locations: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "admin",
    delete: "admin",
  },
  system_settings: {
    authRequired: true,
    select: "admin",
    insert: "admin",
    update: "admin",
    delete: "admin",
  },
  areas: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  stock_movements: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "admin",
    delete: "admin",
  },
  inventory_categories: {
    authRequired: true,
    select: "auth",
    insert: "admin",
    update: "admin",
    delete: "admin",
  },
  expenses: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  purchases: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  returns: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  receipt_vouchers: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  payment_vouchers: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  banks: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  bank_accounts: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  invoice_lines: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  stations: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  station_maintenance: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  station_contract_installments: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  candle_types: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  rep_inventory: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
  rep_inventory_transfers: {
    authRequired: true,
    select: "auth",
    insert: "auth",
    update: "auth",
    delete: "admin",
  },
};

const DELETE_ALL_ORDER = [
  "candle_changes",
  "installments",
  "invoices",
  "maintenance",
  "work_orders",
  "customer_devices",
  "customers",
  "rep_locations",
  "products",
];

function parseRow(table, row) {
  if (!row) return row;

  const jsonFields = JSON_FIELDS[table] || [];
  for (const field of jsonFields) {
    const value = row[field];
    if (typeof value === "string") {
      try {
        row[field] = JSON.parse(value);
      } catch {
        row[field] = field === "candles" ? DEFAULT_CANDLES : [];
      }
    } else if (value == null) {
      row[field] = field === "candles" ? DEFAULT_CANDLES : [];
    }
  }

  return row;
}

function stringifyPayload(table, payload) {
  const nextPayload = { ...payload };
  const jsonFields = JSON_FIELDS[table] || [];

  for (const field of jsonFields) {
    if (field in nextPayload) {
      nextPayload[field] = JSON.stringify(nextPayload[field] ?? (field === "candles" ? DEFAULT_CANDLES : []));
    }
  }

  return nextPayload;
}

function resolveTableKey(tableName) {
  if (!tableName) return null;
  const t = String(tableName).trim();
  if (TABLES[t]) return t;
  const key = Object.keys(TABLES).find((k) => k.toLowerCase() === t.toLowerCase());
  return key || null;
}

module.exports = {
  TABLES,
  JSON_FIELDS,
  DEFAULT_CANDLES,
  DELETE_ALL_ORDER,
  parseRow,
  stringifyPayload,
  resolveTableKey,
};
