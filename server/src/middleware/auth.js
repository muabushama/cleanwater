const { getUserWithProfile, isAdmin } = require("../utils/auth");

async function attachUser(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    req.authToken = null;
    req.user = null;
    return next();
  }

  try {
    const { verifyToken } = require("../utils/auth");
    const payload = verifyToken(token);
    req.authToken = token;
    req.user = await getUserWithProfile(payload.sub);
  } catch {
    req.authToken = null;
    req.user = null;
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "غير مصرح" });
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "غير مصرح" });
  }

  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: "صلاحيات المدير مطلوبة" });
  }

  return next();
}

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin,
};
