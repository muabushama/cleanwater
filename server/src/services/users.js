const crypto = require("crypto");
const { getConnection } = require("../db");
const { hashPassword, getUserWithProfile } = require("../utils/auth");

async function createUser({
  email,
  password,
  fullName,
  branchId = "1",
  phone = "",
  roles = [],
}) {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await connection.query(
      "INSERT INTO users (id, email, password_hash, is_active) VALUES (?, ?, ?, 1)",
      [userId, email.toLowerCase(), passwordHash]
    );

    await connection.query(
      "INSERT INTO profiles (id, full_name, phone, branch_id) VALUES (?, ?, ?, ?)",
      [userId, fullName || "", phone || "", branchId || "1"]
    );

    for (const role of roles) {
      await connection.query(
        "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
        [crypto.randomUUID(), userId, role]
      );
    }

    await connection.commit();
    return getUserWithProfile(userId);
  } catch (error) {
    await connection.rollback();
    const msg = String(error?.message || "");
    if (error?.code === "ER_DUP_ENTRY" || /Duplicate entry/i.test(msg)) {
      const err = new Error("البريد الإلكتروني مستخدم بالفعل");
      err.code = "ER_DUP_ENTRY";
      throw err;
    }
    if (/Data truncated for column 'role'|Incorrect .*role/i.test(msg)) {
      const err = new Error("نوع الصلاحية غير مدعوم في قاعدة البيانات — حدّث جدول user_roles");
      throw err;
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createUser,
};
