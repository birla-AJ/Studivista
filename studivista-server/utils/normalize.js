// Shared normalizer — converts DB snake_case rows to camelCase for app

const toC = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Convert all snake_case keys to camelCase
const normalize = (row) => {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[toC(k)] = v;
  }
  return out;
};

const normalizeList = (rows) => (rows || []).map(normalize);

module.exports = { normalize, normalizeList };
