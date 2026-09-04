const crypto = require("crypto");
const express = require("express");
const { pool, query, getConnection } = require("../db");
const { TABLES, DEFAULT_CANDLES, parseRow, stringifyPayload, resolveTableKey } = require("../schema");
const { buildWhere, buildOrder, buildLimit } = require("../utils/query");
const { isAdmin } = require("../utils/auth");
const {
  mergeBranchScopeFilters,
  applyBranchScopeToInsertRow,
  applyBranchScopeToUpdateValues,
} = require("../utils/branchScope");

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
  const scopedFilters = mergeBranchScopeFilters(req.user, table, filters);
  const where = buildWhere(scopedFilters);

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
  const rows = values
    .filter(Boolean)
    .map((row) =>
      stringifyPayload(table, applyBranchScopeToInsertRow(req.user, table, normalizeRow(table, row, req))),
    );

  if (rows.length === 0) {
    return res.status(400).json({ data: null, error: { message: "No rows provided" } });
  }

  let validCols = null;

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    for (const row of rows) {
      validateMutation(table, row, req);
      let columns = Object.keys(row);
      try {
        const placeholders = columns.map(() => "?").join(", ");
        await connection.query(
          `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES (${placeholders})`,
          columns.map((column) => row[column])
        );
      } catch (insertErr) {
        if (/Unknown column|doesn.t have a default/i.test(insertErr.message || "")) {
          if (!validCols) {
            const [colRows] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
            validCols = new Set(colRows.map((c) => c.Field));
          }
          columns = columns.filter((c) => validCols.has(c));
          const placeholders = columns.map(() => "?").join(", ");
          await connection.query(
            `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES (${placeholders})`,
            columns.map((column) => row[column])
          );
        } else {
          throw insertErr;
        }
      }

      if (table === "customer_devices") {
        await maybeCreateInstallments(connection, row);
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

  const rawValues = applyBranchScopeToUpdateValues(req.user, table, req.body?.values || {});
  const values = stringifyPayload(table, rawValues);
  const fields = Object.keys(values);
  const scopedFilters = mergeBranchScopeFilters(req.user, table, req.body?.filters || []);
  const where = buildWhere(scopedFilters);

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
    const msg = error.message || "";
    if (/Unknown column|doesn.t have a default/i.test(msg)) {
      try {
        const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
        const validCols = new Set(cols.map((c) => c.Field));
        const safeValues = {};
        for (const f of fields) {
          if (validCols.has(f)) safeValues[f] = values[f];
        }
        const safeFields = Object.keys(safeValues);
        if (safeFields.length > 0) {
          await query(
            `UPDATE \`${table}\` SET ${safeFields.map((f) => `\`${f}\` = ?`).join(", ")}${where.sql}`,
            [...safeFields.map((f) => safeValues[f]), ...where.values]
          );
          const rows = await query(`SELECT * FROM \`${table}\`${where.sql}`, where.values);
          return res.json({ data: rows.map((row) => parseRow(table, { ...row })), error: null });
        }
      } catch (retryErr) {
        return res.status(400).json({ data: null, error: { message: retryErr.message || "Update failed" } });
      }
    }
    return res.status(400).json({ data: null, error: { message: error.message || "Update failed" } });
  }
});

router.post("/:table/delete", async (req, res) => {
  if (!ensurePermission(req, res, req.params.table, "delete")) return;
  const table = req.resolvedTable;

  const scopedFilters = mergeBranchScopeFilters(req.user, table, req.body?.filters || []);
  const where = buildWhere(scopedFilters);
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
