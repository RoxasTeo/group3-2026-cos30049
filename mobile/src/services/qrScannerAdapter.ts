/** Accept plain plant IDs, plant:ID tags, and links whose final path segment is the ID. */
export function plantIdFromQr(raw: string) {
  let value = raw.trim();
  if (/^(https?:\/\/|niah-biodiversity:\/\/)/i.test(value)) {
    try {
      const url = new URL(value);
      value = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
    } catch { return null; }
  } else {
    value = value.replace(/^plant:/i, '');
  }
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(value) ? value.toUpperCase() : null;
}
