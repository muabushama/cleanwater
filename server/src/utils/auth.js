const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { query } = require("../db");
const config = require("../config");

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function getUserWithProfile(userId) {
  const rows = await query(
    `
      SELECT
        u.id,
        u.email,
        u.is_active,
        u.created_at,
        p.full_name,
        p.phone,
        p.avatar_url,
        p.branch_id
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );

  if (!rows[0]) {
    return null;
  }

  const roleRows = await query("SELECT role FROM user_roles WHERE user_id = ?", [userId]);

  return {
    id: rows[0].id,
    email: rows[0].email,
    created_at: rows[0].created_at,
    is_active: !!rows[0].is_active,
    profile: {
      full_name: rows[0].full_name || "",
      phone: rows[0].phone || "",
      avatar_url: rows[0].avatar_url || "",
      branch_id: rows[0].branch_id || "1",
    },
    roles: roleRows.map((row) => row.role),
  };
}

function isAdmin(user) {
  return !!user && Array.isArray(user.roles) && user.roles.includes("admin");
}

function isRep(user) {
  return !!user && Array.isArray(user.roles) && user.roles.includes("sales_rep");
}

module.exports = {
  signToken,
  verifyToken,
  hashPassword,
  comparePassword,
  getUserWithProfile,
  isAdmin,
  isRep,
};
