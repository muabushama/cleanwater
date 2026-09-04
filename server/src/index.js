const path = require("path");
const fs = require("fs");
const cors = require("cors");
const express = require("express");
const config = require("./config");
const { query } = require("./db");
const { attachUser } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const queryRoutes = require("./routes/query");
const functionRoutes = require("./routes/functions");
const storageRoutes = require("./routes/storage");

const app = express();
const uploadsDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (
        config.clientOrigins.length === 0 ||
        config.clientOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked for this origin"));
    },
    credentials: false,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(attachUser);
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1 AS ok");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/functions", functionRoutes);
app.use("/api/storage", storageRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

async function autoMigrate() {
  // ── 1) CREATE TABLE IF NOT EXISTS for all app tables ──
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS areas (
      id VARCHAR(36) PRIMARY KEY, name VARCHAR(191) NOT NULL,
      parent_id VARCHAR(36) NULL, branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_areas_branch (branch), KEY idx_areas_parent (parent_id))`,
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id VARCHAR(36) PRIMARY KEY, product_id VARCHAR(36) NOT NULL,
      branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      type VARCHAR(50) NOT NULL DEFAULT 'sale', quantity INT NOT NULL DEFAULT 0,
      unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0, movement_date DATE NULL,
      warehouse_id VARCHAR(36) NULL,
      technician_user_id VARCHAR(36) NULL,
      reference_type VARCHAR(50) NULL, reference_id VARCHAR(36) NULL,
      notes TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_sm_product (product_id), KEY idx_sm_branch (branch), KEY idx_sm_created (created_at))`,
    `CREATE TABLE IF NOT EXISTS inventory_categories (
      id VARCHAR(36) PRIMARY KEY, name VARCHAR(191) NOT NULL,
      icon_key VARCHAR(50) NOT NULL DEFAULT 'default', parent_id VARCHAR(36) NULL,
      sort_order INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_inv_cat_parent (parent_id))`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(36) PRIMARY KEY, expense_number VARCHAR(191) NOT NULL,
      category VARCHAR(191) NOT NULL DEFAULT 'عام', payee_name VARCHAR(191) NOT NULL DEFAULT '',
      amount DECIMAL(12,2) NOT NULL DEFAULT 0, expense_date DATE NOT NULL,
      branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      bank_account_id VARCHAR(36) NULL, notes TEXT NULL,
      created_by VARCHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_expenses_branch (branch), KEY idx_expenses_date (expense_date))`,
    `CREATE TABLE IF NOT EXISTS banks (
      id VARCHAR(36) PRIMARY KEY, name VARCHAR(191) NOT NULL,
      branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_banks_branch (branch))`,
    `CREATE TABLE IF NOT EXISTS bank_accounts (
      id VARCHAR(36) PRIMARY KEY, bank_id VARCHAR(36) NOT NULL,
      account_name VARCHAR(191) NOT NULL, account_number VARCHAR(191) NOT NULL DEFAULT '',
      balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ba_bank (bank_id), KEY idx_ba_branch (branch))`,
    `CREATE TABLE IF NOT EXISTS receipt_vouchers (
      id VARCHAR(36) PRIMARY KEY, voucher_number VARCHAR(191) NOT NULL,
      voucher_date DATE NOT NULL, amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      invoice_id VARCHAR(36) NULL, customer_name VARCHAR(191) NOT NULL DEFAULT '',
      payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
      bank_account_id VARCHAR(36) NULL,
      branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      status VARCHAR(50) NOT NULL DEFAULT 'active', notes TEXT NULL,
      created_by VARCHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_rv_invoice (invoice_id), KEY idx_rv_date (voucher_date), KEY idx_rv_branch (branch))`,
    `CREATE TABLE IF NOT EXISTS payment_vouchers (
      id VARCHAR(36) PRIMARY KEY, voucher_number VARCHAR(191) NOT NULL,
      voucher_date DATE NOT NULL, amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      expense_id VARCHAR(36) NULL, payee_name VARCHAR(191) NOT NULL DEFAULT '',
      bank_account_id VARCHAR(36) NULL,
      branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية', notes TEXT NULL,
      created_by VARCHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_pv_expense (expense_id), KEY idx_pv_date (voucher_date), KEY idx_pv_branch (branch))`,
    `CREATE TABLE IF NOT EXISTS purchases (
      id VARCHAR(36) PRIMARY KEY, purchase_number VARCHAR(191) NOT NULL,
      supplier_name VARCHAR(191) NOT NULL DEFAULT '', product_id VARCHAR(36) NULL,
      product_name VARCHAR(191) NOT NULL DEFAULT '', quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(12,2) NOT NULL DEFAULT 0, total DECIMAL(12,2) NOT NULL DEFAULT 0,
      purchase_date DATE NOT NULL, branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      invoice_file_url TEXT NULL, rep_name VARCHAR(191) NULL, notes TEXT NULL,
      created_by VARCHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_pur_branch (branch), KEY idx_pur_date (purchase_date))`,
    `CREATE TABLE IF NOT EXISTS returns (
      id VARCHAR(36) PRIMARY KEY, return_number VARCHAR(191) NOT NULL,
      invoice_id VARCHAR(36) NULL, customer_name VARCHAR(191) NOT NULL DEFAULT '',
      product_id VARCHAR(36) NULL, product_name VARCHAR(191) NOT NULL DEFAULT '',
      quantity INT NOT NULL DEFAULT 1, amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      return_date DATE NOT NULL, branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      return_type VARCHAR(50) NOT NULL DEFAULT 'customer',
      supplier_name VARCHAR(191) NULL, supplier_phone VARCHAR(50) NULL, reason TEXT NULL,
      rep_name VARCHAR(191) NULL, notes TEXT NULL,
      created_by VARCHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ret_branch (branch), KEY idx_ret_date (return_date))`,
    `CREATE TABLE IF NOT EXISTS stations (
      id VARCHAR(36) PRIMARY KEY, name VARCHAR(191) NOT NULL,
      customer_id VARCHAR(36) NULL, customer_name VARCHAR(191) NOT NULL DEFAULT '',
      customer_phone VARCHAR(50) NULL, customer_address TEXT NULL,
      area VARCHAR(191) NULL, address TEXT NULL, station_type VARCHAR(100) NULL,
      capacity VARCHAR(191) NULL, install_date DATE NULL,
      warranty_months INT NOT NULL DEFAULT 12, warranty_end DATE NULL,
      contract_type VARCHAR(100) NOT NULL DEFAULT 'بدون عقد',
      contract_value DECIMAL(12,2) NOT NULL DEFAULT 0,
      contract_duration_months INT NOT NULL DEFAULT 0,
      contract_start_date DATE NULL, contract_end_date DATE NULL,
      contract_first_visit_date DATE NULL,
      contract_installments_count INT NOT NULL DEFAULT 0,
      contract_installment_interval_months INT NOT NULL DEFAULT 1,
      contract_first_installment_date DATE NULL,
      location TEXT NULL, branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      status VARCHAR(50) NOT NULL DEFAULT 'active', notes TEXT NULL,
      created_by VARCHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_stations_branch (branch))`,
    `CREATE TABLE IF NOT EXISTS station_maintenance (
      id VARCHAR(36) PRIMARY KEY, station_id VARCHAR(36) NOT NULL,
      maintenance_date DATE NOT NULL, maintenance_type VARCHAR(100) NOT NULL DEFAULT 'صيانة دورية',
      description TEXT NULL, parts_used TEXT NULL,
      parts_cost DECIMAL(12,2) NOT NULL DEFAULT 0, labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_cost DECIMAL(12,2) NOT NULL DEFAULT 0, total_sale DECIMAL(12,2) NOT NULL DEFAULT 0,
      collected DECIMAL(12,2) NOT NULL DEFAULT 0,
      product_lines JSON NULL, changed_candles JSON NULL,
      technician VARCHAR(191) NULL, notes TEXT NULL,
      branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_stm_station (station_id), KEY idx_stm_date (maintenance_date))`,
    `CREATE TABLE IF NOT EXISTS station_contract_installments (
      id VARCHAR(36) PRIMARY KEY, station_id VARCHAR(36) NOT NULL,
      installment_date DATE NULL, amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(100) NOT NULL DEFAULT 'معلق', collection_date DATE NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_sci_station (station_id))`,
    `CREATE TABLE IF NOT EXISTS invoice_lines (
      id VARCHAR(36) PRIMARY KEY, invoice_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NULL, product_name VARCHAR(191) NOT NULL DEFAULT '',
      quantity INT NOT NULL DEFAULT 1, unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      total DECIMAL(12,2) NOT NULL DEFAULT 0, line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_il_invoice (invoice_id))`,
    `CREATE TABLE IF NOT EXISTS candle_types (
      id VARCHAR(36) PRIMARY KEY, name VARCHAR(191) NOT NULL,
      duration_months INT NOT NULL DEFAULT 3, price DECIMAL(12,2) NOT NULL DEFAULT 0,
      branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      sort_order INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ct_branch (branch))`,
    `CREATE TABLE IF NOT EXISTS rep_inventory (
      id VARCHAR(36) PRIMARY KEY, rep_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NOT NULL, quantity INT NOT NULL DEFAULT 0,
      branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ri_rep (rep_id), KEY idx_ri_product (product_id))`,
    `CREATE TABLE IF NOT EXISTS rep_inventory_transfers (
      id VARCHAR(36) PRIMARY KEY, from_type VARCHAR(50) NOT NULL DEFAULT 'main',
      to_rep_id VARCHAR(36) NOT NULL, product_id VARCHAR(36) NOT NULL,
      quantity INT NOT NULL DEFAULT 0, notes TEXT NULL,
      created_by VARCHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_rit_rep (to_rep_id), KEY idx_rit_product (product_id))`,
  ];

  for (const sql of createStatements) {
    try { await query(sql); } catch (_) {}
  }

  // ── 2) ALTER TABLE ADD COLUMN for every potentially missing column ──
  const cols = [
    // products
    { t: "products", c: "sku_code", d: "VARCHAR(64) NULL" },
    { t: "products", c: "barcode", d: "VARCHAR(128) NULL" },
    { t: "products", c: "unit", d: "VARCHAR(32) NULL DEFAULT 'قطعة'" },
    { t: "products", c: "supplier_name", d: "VARCHAR(191) NULL" },
    { t: "products", c: "description", d: "TEXT NULL" },
    { t: "products", c: "serial_number", d: "INT NULL" },
    { t: "products", c: "branch", d: "VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية'" },
    { t: "products", c: "storage_location", d: "VARCHAR(191) NOT NULL DEFAULT 'المخزن الرئيسي'" },

    // customers
    { t: "customers", c: "customer_code", d: "VARCHAR(64) NULL" },
    { t: "customers", c: "customer_type", d: "VARCHAR(50) NOT NULL DEFAULT 'sales'" },
    { t: "customers", c: "phone2", d: "VARCHAR(50) NULL" },
    { t: "customers", c: "area_id", d: "VARCHAR(36) NULL" },

    // invoices
    { t: "invoices", c: "quantity", d: "INT NOT NULL DEFAULT 1" },
    { t: "invoices", c: "product_id", d: "VARCHAR(36) NULL" },
    { t: "invoices", c: "rep_names", d: "JSON NULL" },
    { t: "invoices", c: "due_date", d: "DATE NULL" },
    { t: "invoices", c: "delivery_status", d: "VARCHAR(50) NOT NULL DEFAULT 'pending'" },
    { t: "invoices", c: "notes", d: "TEXT NULL" },
    { t: "invoices", c: "subtotal", d: "DECIMAL(12,2) NULL" },
    { t: "invoices", c: "discount_percent", d: "DECIMAL(5,2) NOT NULL DEFAULT 0" },
    { t: "invoices", c: "discount_amount", d: "DECIMAL(12,2) NOT NULL DEFAULT 0" },
    { t: "invoices", c: "tax_percent", d: "DECIMAL(5,2) NOT NULL DEFAULT 0" },
    { t: "invoices", c: "tax_amount", d: "DECIMAL(12,2) NOT NULL DEFAULT 0" },
    { t: "invoices", c: "auto_stock_deduct", d: "TINYINT(1) NOT NULL DEFAULT 1" },
    { t: "invoices", c: "invoice_direction", d: "VARCHAR(50) NOT NULL DEFAULT 'مبيعات'" },
    { t: "invoices", c: "technician", d: "VARCHAR(191) NULL" },

    // candle_changes
    { t: "candle_changes", c: "candle8", d: "TINYINT(1) NOT NULL DEFAULT 0" },
    { t: "candle_changes", c: "candle9", d: "TINYINT(1) NOT NULL DEFAULT 0" },
    { t: "candle_changes", c: "candle10", d: "TINYINT(1) NOT NULL DEFAULT 0" },

    // maintenance
    { t: "maintenance", c: "next_dates", d: "JSON NULL" },

    // work_orders
    { t: "work_orders", c: "area_id", d: "VARCHAR(36) NULL" },

    // stock_movements
    { t: "stock_movements", c: "unit_cost", d: "DECIMAL(12,2) NOT NULL DEFAULT 0" },
    { t: "stock_movements", c: "movement_date", d: "DATE NULL" },
    { t: "stock_movements", c: "warehouse_id", d: "VARCHAR(36) NULL" },
    { t: "stock_movements", c: "technician_user_id", d: "VARCHAR(36) NULL" },
    { t: "stock_movements", c: "storage_location", d: "VARCHAR(64) NULL" },

    // returns
    { t: "returns", c: "return_type", d: "VARCHAR(50) NOT NULL DEFAULT 'customer'" },
    { t: "returns", c: "supplier_name", d: "VARCHAR(191) NULL" },
    { t: "returns", c: "supplier_phone", d: "VARCHAR(50) NULL" },
    { t: "returns", c: "reason", d: "TEXT NULL" },

    // invoice_lines
    { t: "invoice_lines", c: "total", d: "DECIMAL(12,2) NOT NULL DEFAULT 0" },

    // customer_devices
    { t: "customer_devices", c: "contract_value", d: "DECIMAL(12,2) NOT NULL DEFAULT 0" },
    { t: "customer_devices", c: "contract_duration_months", d: "INT NOT NULL DEFAULT 0" },
    { t: "customer_devices", c: "contract_start_date", d: "DATE NULL" },
    { t: "customer_devices", c: "contract_end_date", d: "DATE NULL" },
    { t: "customer_devices", c: "contract_first_visit_date", d: "DATE NULL" },
    { t: "customer_devices", c: "contract_installment_interval_months", d: "INT NOT NULL DEFAULT 1" },
    { t: "customer_devices", c: "first_installment_date", d: "DATE NULL" },
    { t: "customer_devices", c: "installments_count", d: "INT NULL" },

    // stations (if table was created earlier without all columns)
    { t: "stations", c: "area", d: "VARCHAR(191) NULL" },
    { t: "stations", c: "address", d: "TEXT NULL" },
    { t: "stations", c: "station_type", d: "VARCHAR(100) NULL" },
    { t: "stations", c: "capacity", d: "VARCHAR(191) NULL" },
    { t: "stations", c: "install_date", d: "DATE NULL" },
    { t: "stations", c: "customer_phone", d: "VARCHAR(50) NULL" },
    { t: "stations", c: "customer_address", d: "TEXT NULL" },
    { t: "stations", c: "warranty_months", d: "INT NOT NULL DEFAULT 12" },
    { t: "stations", c: "warranty_end", d: "DATE NULL" },
    { t: "stations", c: "contract_type", d: "VARCHAR(100) NOT NULL DEFAULT 'بدون عقد'" },
    { t: "stations", c: "contract_value", d: "DECIMAL(12,2) NOT NULL DEFAULT 0" },
    { t: "stations", c: "contract_duration_months", d: "INT NOT NULL DEFAULT 0" },
    { t: "stations", c: "contract_start_date", d: "DATE NULL" },
    { t: "stations", c: "contract_end_date", d: "DATE NULL" },
    { t: "stations", c: "contract_first_visit_date", d: "DATE NULL" },
    { t: "stations", c: "contract_installments_count", d: "INT NOT NULL DEFAULT 0" },
    { t: "stations", c: "contract_installment_interval_months", d: "INT NOT NULL DEFAULT 1" },
    { t: "stations", c: "contract_first_installment_date", d: "DATE NULL" },

    // station maintenance visit financial and candle details
    { t: "station_maintenance", c: "total_sale", d: "DECIMAL(12,2) NOT NULL DEFAULT 0" },
    { t: "station_maintenance", c: "product_lines", d: "JSON NULL" },
    { t: "station_maintenance", c: "changed_candles", d: "JSON NULL" },

    // purchases
    { t: "purchases", c: "paid", d: "DECIMAL(12,2) NOT NULL DEFAULT 0" },
    { t: "purchases", c: "remaining", d: "DECIMAL(12,2) NOT NULL DEFAULT 0" },
    { t: "purchases", c: "items", d: "JSON NULL" },
  ];

  let added = 0;
  for (const { t, c, d } of cols) {
    try {
      await query(`ALTER TABLE \`${t}\` ADD COLUMN \`${c}\` ${d}`);
      added++;
      console.log(`[migrate] + ${t}.${c}`);
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME" || /Duplicate column/i.test(err.message || "")) continue;
      if (/doesn.t exist|no such table/i.test(err.message || "")) continue;
    }
  }

  // Ensure all staff roles are allowed in user_roles.role ENUM
  try {
    await query(
      "ALTER TABLE `user_roles` MODIFY COLUMN `role` ENUM('admin','sales_rep','customer_service','warehouse_keeper','staff') NOT NULL"
    );
    console.log("[migrate] user_roles.role ENUM updated");
  } catch (err) {
    if (!/doesn't exist|no such table/i.test(err.message || "")) {
      console.warn("[migrate] user_roles ENUM:", err.message);
    }
  }

  if (added > 0) console.log(`[migrate] Added ${added} column(s)`);
  else console.log("[migrate] Schema up to date");
}

autoMigrate()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Oasis API listening on port ${config.port}`);
    });
  })
  .catch((err) => {
    console.error("[migrate] Error:", err.message);
    app.listen(config.port, () => {
      console.log(`Oasis API listening on port ${config.port}`);
    });
  });
