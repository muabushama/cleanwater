const express = require("express");
const { query } = require("../db");
const { requireAdmin, requireAuth } = require("../middleware/auth");
const {
  signToken,
  hashPassword,
  comparePassword,
  getUserWithProfile,
} = require("../utils/auth");
const { createUser } = require("../services/users");

const router = express.Router();

async function hasAnyUsers() {
  const rows = await query("SELECT COUNT(*) AS count FROM users");
  return Number(rows[0]?.count || 0) > 0;
}

router.get("/setup-status", async (_req, res) => {
  const rows = await query("SELECT COUNT(*) AS count FROM user_roles WHERE role = 'admin'");
  const adminCount = Number(rows[0]?.count || 0);
  res.json({ needsSetup: adminCount === 0 });
});

router.post("/setup-admin", async (req, res) => {
  const { email, password, full_name, branch_id } = req.body || {};
  const alreadyInitialized = await hasAnyUsers();

  if (alreadyInitialized) {
    return res.status(400).json({ error: "تم إعداد النظام بالفعل" });
  }

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
  }

  try {
    const user = await createUser({
      email,
      password,
      fullName: full_name,
      branchId: branch_id || "1",
      roles: ["admin"],
    });

    await query(
      "INSERT INTO system_settings (`key`, `value`) VALUES ('delete_password', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [password]
    );

    const token = signToken(user);
    return res.json({ token, user });
  } catch (error) {
    return res.status(400).json({ error: error.message || "تعذر إنشاء الأدمن" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" });
  }

  const rows = await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email.toLowerCase()]);
  const account = rows[0];

  if (!account || !account.password_hash) {
    return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
  }

  const matches = await comparePassword(password, account.password_hash);
  if (!matches) {
    return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
  }

  const user = await getUserWithProfile(account.id);
  const token = signToken(user);
  return res.json({ token, user });
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

router.post("/logout", requireAuth, async (_req, res) => {
  return res.json({ success: true });
});

router.post("/verify-delete-password", requireAuth, async (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: "كلمة المرور مطلوبة" });
  }
  const rows = await query("SELECT `value` FROM system_settings WHERE `key` = 'delete_password' LIMIT 1");
  const stored = rows[0]?.value || "";
  if (stored !== password) {
    return res.status(400).json({ error: "كلمة المرور غير صحيحة" });
  }
  return res.json({ ok: true });
});

const ALLOWED_ROLES = ["admin", "sales_rep", "customer_service", "warehouse_keeper"];

router.post("/signup", async (req, res) => {
  const { email, password, options } = req.body || {};
  const fullName = options?.data?.full_name || "";
  const role = options?.data?.role || "admin";
  const branchId = options?.data?.branch_id || "1";
  const phone = options?.data?.phone || "";

  if (!email || !password) {
    return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
  }

  const alreadyInitialized = await hasAnyUsers();
  if (alreadyInitialized) {
    return res.status(403).json({ error: "إنشاء الحساب غير متاح من الواجهة الحالية" });
  }

  const chosenRole = ALLOWED_ROLES.includes(role) ? role : "admin";

  try {
    const user = await createUser({
      email,
      password,
      fullName,
      branchId,
      phone,
      roles: [chosenRole],
    });

    if (chosenRole === "admin") {
      await query(
        "INSERT INTO system_settings (`key`, `value`) VALUES ('delete_password', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
        [password]
      );
    }

    const token = signToken(user);
    return res.json({ token, user });
  } catch (error) {
    return res.status(400).json({ error: error.message || "تعذر إنشاء الحساب" });
  }
});

router.post("/create-rep", requireAdmin, async (req, res) => {
  const { email, password, full_name, branch_id, phone } = req.body || {};

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
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

router.post("/create-warehouse-keeper", requireAdmin, async (req, res) => {
  const { email, password, full_name, branch_id, phone } = req.body || {};

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
  }

  try {
    const user = await createUser({
      email,
      password,
      fullName: full_name,
      branchId: branch_id || "1",
      phone: phone || "",
      roles: ["warehouse_keeper"],
    });

    return res.json({ success: true, user });
  } catch (error) {
    return res.status(400).json({ error: error.message || "تعذر إنشاء أمين المخزن" });
  }
});

router.post("/create-customer-service", requireAdmin, async (req, res) => {
  const { email, password, full_name, branch_id, phone } = req.body || {};

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
  }

  try {
    const user = await createUser({
      email,
      password,
      fullName: full_name,
      branchId: branch_id || "1",
      phone: phone || "",
      roles: ["customer_service"],
    });

    return res.json({ success: true, user });
  } catch (error) {
    return res.status(400).json({ error: error.message || "تعذر إنشاء حساب خدمة العملاء" });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "كلمتا المرور مطلوبة" });
  }

  const rows = await query("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [req.user.id]);
  const account = rows[0];
  const matches = await comparePassword(currentPassword, account?.password_hash || "");

  if (!matches) {
    return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
  }

  const nextHash = await hashPassword(newPassword);
  await query("UPDATE users SET password_hash = ? WHERE id = ?", [nextHash, req.user.id]);
  return res.json({ success: true });
});

module.exports = router;
