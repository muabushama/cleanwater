/** طباعة النظام: أسود وبولد فقط، بدون رمادي. */
export const PRINT_INK_CSS = `
  * { color: #000 !important; font-weight: 700 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { color: #000 !important; font-weight: 700 !important; background: #fff !important; }
  p, td, th, span, div, h1, h2, h3, label { color: #000 !important; font-weight: 700 !important; }
`;
