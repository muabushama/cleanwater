function normalizeFilters(filters = []) {
  return Array.isArray(filters) ? filters : [];
}

function buildWhere(filters = []) {
  const clauses = [];
  const values = [];

  for (const filter of normalizeFilters(filters)) {
    if (!filter || !filter.field || !filter.operator) {
      continue;
    }

    if (filter.operator === "eq") {
      clauses.push(`\`${filter.field}\` = ?`);
      values.push(filter.value);
      continue;
    }

    if (filter.operator === "neq") {
      clauses.push(`\`${filter.field}\` <> ?`);
      values.push(filter.value);
      continue;
    }

    if (filter.operator === "like") {
      const val = filter.value != null ? String(filter.value) : "";
      clauses.push(`\`${filter.field}\` LIKE ?`);
      values.push("%" + val + "%");
      continue;
    }

    if (filter.operator === "in") {
      const list = Array.isArray(filter.value) ? filter.value : [];
      if (list.length === 0) {
        clauses.push("1 = 0");
      } else {
        clauses.push(`\`${filter.field}\` IN (${list.map(() => "?").join(", ")})`);
        values.push(...list);
      }
      continue;
    }

    if (filter.operator === "not" && filter.comparator === "is") {
      if (filter.value == null) {
        clauses.push(`\`${filter.field}\` IS NOT NULL`);
      } else {
        clauses.push(`\`${filter.field}\` <> ?`);
        values.push(filter.value);
      }
    }
  }

  return {
    sql: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

function buildOrder(order) {
  if (!order || !order.field) {
    return "";
  }

  return ` ORDER BY \`${order.field}\` ${order.ascending === false ? "DESC" : "ASC"}`;
}

function buildLimit(limit) {
  if (!Number.isFinite(limit) || limit <= 0) {
    return "";
  }

  return ` LIMIT ${Math.floor(limit)}`;
}

module.exports = {
  buildWhere,
  buildOrder,
  buildLimit,
};
