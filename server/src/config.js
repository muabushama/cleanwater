const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const splitCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const derivedRailwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : "";

const config = {
  port: toInt(process.env.PORT, 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigins: splitCsv(process.env.CLIENT_ORIGIN || "http://localhost:8080"),
  jwtSecret: process.env.JWT_SECRET || "change-me",
  publicBaseUrl: (
    process.env.PUBLIC_BASE_URL ||
    derivedRailwayUrl ||
    `http://localhost:${toInt(process.env.PORT, 3001)}`
  ).replace(/\/+$/, ""),
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: toInt(process.env.MYSQL_PORT, 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "oasis_suite",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },
};

module.exports = config;
