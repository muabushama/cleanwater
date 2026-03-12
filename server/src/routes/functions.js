const express = require("express");
const { query } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const { DELETE_ALL_ORDER, parseRow } = require("../schema");
const { createUser } = require("../services/users");

const router = express.Router();

router.post("/manage-users", requireAdmin, async (req, res) => {
  const { action, email, password, full_name, branch_id, phone } = req.body || {};

  if (action !== "create_rep") {
    return res.status(400).json({ error: "Invalid action" });
  }

  try {
    const user = await createUser({
      email,
      password,
      fullName: full_name,
      branchId: branch_id || "1",
      phone: phone || "",
      roles: ["sales_rep"],
    });
    return res.json({ success: true, user });
  } catch (error) {
    return res.status(400).json({ error: error.message || "تعذر إنشاء المندوب" });
  }
});

router.post("/manage-backup", requireAdmin, async (req, res) => {
  const { action, password, newPassword } = req.body || {};

  if (action === "export") {
    const tables = [
      "customers",
      "customer_devices",
      "candle_changes",
      "installments",
      "invoices",
      "maintenance",
      "products",
      "work_orders",
      "profiles",
      "rep_locations",
      "user_roles",
    ];

    const data = {};
    let totalRecords = 0;

    for (const table of tables) {
      const rows = await query(`SELECT * FROM \`${table}\``);
      data[table] = rows.map((row) => parseRow(table, { ...row }));
      totalRecords += data[table].length;
    }

    return res.json({
      data,
      exported_at: new Date().toISOString(),
      exported_by: req.user.email,
      total_records: totalRecords,
    });
  }

  if (action === "delete-all") {
    if (!password) {
      return res.status(400).json({ error: "كلمة السر مطلوبة" });
    }

    const settings = await query("SELECT `value` FROM system_settings WHERE `key` = 'delete_password' LIMIT 1");
    if ((settings[0]?.value || "") !== password) {
      return res.status(400).json({ error: "كلمة السر غير صحيحة" });
    }

    const details = {};
    for (const table of DELETE_ALL_ORDER) {
      await query(`DELETE FROM \`${table}\``);
      details[table] = "deleted";
    }

    return res.json({
      success: true,
      message: "تم مسح جميع البيانات بنجاح",
      details,
    });
  }

  if (action === "change-password") {
    if (!password || !newPassword) {
      return res.status(400).json({ error: "كلمة السر الحالية والجديدة مطلوبة" });
    }

    const settings = await query("SELECT `value` FROM system_settings WHERE `key` = 'delete_password' LIMIT 1");
    if ((settings[0]?.value || "") !== password) {
      return res.status(400).json({ error: "كلمة السر الحالية غير صحيحة" });
    }

    await query(
      "INSERT INTO system_settings (`key`, `value`) VALUES ('delete_password', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = CURRENT_TIMESTAMP",
      [newPassword]
    );

    return res.json({
      success: true,
      message: "تم تغيير كلمة السر بنجاح",
    });
  }

  return res.status(400).json({ error: "Invalid action" });
});

module.exports = router;
