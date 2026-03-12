const crypto = require("crypto");
const express = require("express");
const { query, getConnection } = require("../db");
const { TABLES, DEFAULT_CANDLES, parseRow, stringifyPayload, resolveTableKey } = require("../schema");
const { buildWhere, buildOrder, buildLimit } = require("../utils/query");
const { isAdmin } = require("../utils/auth");

async function deductStockOnInvoice(connection, row) {
  let productId = row.product_id;
  const qty = Math.max(0, Number(row.quantity) || 1);
  const branch = row.branch || "فرع الإسكندرية";
  if (qty <= 0) return;

  if (!productId && row.product_name) {
    const [byName] = await connection.query(
      "SELECT id FROM products WHERE name = ? LIMIT 1",
      [row.product_name]
    );
    if (byName && byName[0]) productId = byName[0].id;
  }
  if (!productId) return;

  const [updated] = await connection.query(
    "UPDATE products SET stock = GREATEST(0, COALESCE(stock, 0) - ?) WHERE id = ?",
    [qty, productId]
  );
  if (updated.affectedRows === 0) return;

  const movementId = crypto.randomUUID();
  await connection.query(
    "INSERT INTO stock_movements (id, product_id, branch, type, quantity, reference_type, reference_id) VALUES (?, ?, ?, 'sale', ?, 'invoice', ?)",
    [movementId, productId, branch, qty, row.id]
  ).catch(() => {});
}

const router = express.Router();

function ensurePermission(req, res, table, action) {
  const tableKey = resolveTableKey(table);
  if (!tableKey) {
    res.status(404).json({ error: "جدول غير مدعوم" });
    return false;
  }
  const config = TABLES[tableKey];
  if (!config) {
    res.status(404).json({ error: "جدول غير مدعوم" });
    return false;
  }
  req.resolvedTable = tableKey;

  if (config.authRequired && !req.user) {
    res.status(401).json({ error: "غير مصرح" });
    return false;
  }

  const permission = config[action];
  if (permission === "admin" && !isAdmin(req.user)) {
    res.status(403).json({ error: "صلاحيات المدير مطلوبة" });
    return false;
  }

  return true;
}

function normalizeRow(table, row, req) {
  const nextRow = { ...row };

  if ("created_by" in nextRow && !nextRow.created_by && req.user) {
    nextRow.created_by = req.user.id;
  }

  if (table === "customer_devices") {
    nextRow.candles = nextRow.candles ?? DEFAULT_CANDLES;
  }

  if (table === "work_orders") {
    nextRow.items = nextRow.items ?? [];
    nextRow.previous_visits = nextRow.previous_visits ?? [];
  }

  if ("id" in nextRow && !nextRow.id) {
    nextRow.id = crypto.randomUUID();
  }

  return nextRow;
}

function validateMutation(table, row, req) {
  if (table === "rep_locations" && !isAdmin(req.user) && row.user_id !== req.user?.id) {
    throw new Error("غير مسموح بتسجيل موقع لمستخدم آخر");
  }

  if (table === "profiles" && !isAdmin(req.user) && row.id && row.id !== req.user?.id) {
    throw new Error("غير مسموح بتعديل ملف مستخدم آخر");
  }
}

async function maybeCreateInstallments(connection, row) {
  if (row.contract_type !== "تقسيط" || !row.installments_count || !row.installment_amount) {
    return;
  }

  const count = Number(row.installments_count || 0);
  const amount = Number(row.installment_amount || 0);
  const startDate = row.first_installment_date ? new Date(row.first_installment_date) : new Date();

  for (let index = 0; index < count; index += 1) {
    const nextDate = new Date(startDate);
    nextDate.setMonth(nextDate.getMonth() + index);
    const installmentDate = nextDate.toISOString().slice(0, 10);

    await connection.query(
      `
        INSERT INTO installments (id, customer_id, device_id, installment_date, amount, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        crypto.randomUUID(),
        row.customer_id,
        row.id,
        installmentDate,
        amount,
        "معلق",
      ]
    );
  }
}

router.post("/:table/select", async (req, res) => {
  if (!ensurePermission(req, res, req.params.table, "select")) return;
  const table = req.resolvedTable;

  const { columns = "*", filters = [], order = null, limit = null } = req.body || {};
  const where = buildWhere(filters);

  try {
    let sql = `SELECT * FROM \`${table}\``;
    let values = [...where.values];

    if (table === "rep_locations" && String(columns).includes("profiles:user_id(")) {
      sql = `
        SELECT rep_locations.*, profiles.full_name AS profile_full_name
        FROM rep_locations
        LEFT JOIN profiles ON profiles.id = rep_locations.user_id
      `;
    }

    sql += where.sql;
    sql += buildOrder(order);
    sql += buildLimit(limit);

    const rows = await query(sql, values);
    const parsed = rows.map((row) => {
      const nextRow = parseRow(table, { ...row });
      if (table === "rep_locations" && "profile_full_name" in nextRow) {
        nextRow.profiles = nextRow.profile_full_name ? { full_name: nextRow.profile_full_name } : null;
        delete nextRow.profile_full_name;
      }
      return nextRow;
    });

    return res.json({ data: parsed, error: null });
  } catch (error) {
    return res.status(400).json({ data: null, error: { message: error.message || "Select failed" } });
  }
});

router.post("/:table/insert", async (req, res) => {
  if (!ensurePermission(req, res, req.params.table, "insert")) return;
  const table = req.resolvedTable;

  const values = Array.isArray(req.body?.values) ? req.body.values : [req.body?.values];
  const rows = values.filter(Boolean).map((row) => stringifyPayload(table, normalizeRow(table, row, req)));

  if (rows.length === 0) {
    return res.status(400).json({ data: null, error: { message: "No rows provided" } });
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    for (const row of rows) {
      validateMutation(table, row, req);
      const columns = Object.keys(row);
      const placeholders = columns.map(() => "?").join(", ");
      await connection.query(
        `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES (${placeholders})`,
        columns.map((column) => row[column])
      );

      if (table === "customer_devices") {
        await maybeCreateInstallments(connection, row);
      }
      if (table === "invoices" && row.product_id) {
        await deductStockOnInvoice(connection, row);
      }
    }

    await connection.commit();
    return res.json({ data: rows.map((row) => parseRow(table, { ...row })), error: null });
  } catch (error) {
    await connection.rollback();
    return res.status(400).json({ data: null, error: { message: error.message || "Insert failed" } });
  } finally {
    connection.release();
  }
});

router.post("/:table/update", async (req, res) => {
  if (!ensurePermission(req, res, req.params.table, "update")) return;
  const table = req.resolvedTable;

  const values = stringifyPayload(table, req.body?.values || {});
  const fields = Object.keys(values);
  const where = buildWhere(req.body?.filters || []);

  if (fields.length === 0) {
    return res.status(400).json({ data: null, error: { message: "No values provided" } });
  }

  try {
    validateMutation(table, values, req);
    await query(
      `UPDATE \`${table}\` SET ${fields.map((field) => `\`${field}\` = ?`).join(", ")}${where.sql}`,
      [...fields.map((field) => values[field]), ...where.values]
    );

    const rows = await query(`SELECT * FROM \`${table}\`${where.sql}`, where.values);
    return res.json({ data: rows.map((row) => parseRow(table, { ...row })), error: null });
  } catch (error) {
    return res.status(400).json({ data: null, error: { message: error.message || "Update failed" } });
  }
});

router.post("/:table/delete", async (req, res) => {
  if (!ensurePermission(req, res, req.params.table, "delete")) return;
  const table = req.resolvedTable;

  const where = buildWhere(req.body?.filters || []);
  if (!where.sql) {
    return res.status(400).json({ data: null, error: { message: "Delete requires filters" } });
  }

  try {
    await query(`DELETE FROM \`${table}\`${where.sql}`, where.values);
    return res.json({ data: [], error: null });
  } catch (error) {
    return res.status(400).json({ data: null, error: { message: error.message || "Delete failed" } });
  }
});

module.exports = router;
