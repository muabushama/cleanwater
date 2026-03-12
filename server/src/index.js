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

app.listen(config.port, () => {
  console.log(`Oasis API listening on port ${config.port}`);
});
