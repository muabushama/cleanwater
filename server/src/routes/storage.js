const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const config = require("../config");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const targetDir = path.resolve(process.cwd(), "uploads", req.params.bucket || "misc");
      ensureDir(targetDir);
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const requestedPath = String(req.body?.path || "").trim().replace(/^\/+/, "");
      const safeName = requestedPath
        ? path.basename(requestedPath)
        : `${crypto.randomUUID()}${path.extname(file.originalname || "")}`;
      cb(null, safeName);
    },
  }),
});

router.post("/:bucket/upload", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: "No file uploaded" } });
  }

  const publicUrl = `${config.publicBaseUrl}/uploads/${req.params.bucket}/${req.file.filename}`;
  return res.json({
    data: {
      path: req.file.filename,
      fullPath: `${req.params.bucket}/${req.file.filename}`,
      publicUrl,
    },
    error: null,
  });
});

module.exports = router;
