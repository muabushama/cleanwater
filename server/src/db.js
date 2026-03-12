const mysql = require("mysql2/promise");
const config = require("./config");

const pool = mysql.createPool(config.mysql);

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function getConnection() {
  return pool.getConnection();
}

module.exports = {
  pool,
  query,
  getConnection,
};
