// Usage:
//   node scripts/get-telegram-webhook-info.js
// Requires env:
//   TELEGRAM_BOT_TOKEN
//
// Prints Telegram getWebhookInfo() response (safe: does not print token).

// Optional .env support for local dev
try {
  await import('dotenv/config');
} catch {
  // ok
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const token = requiredEnv('TELEGRAM_BOT_TOKEN');

  const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
    method: 'GET',
  });

  const data = await response.json().catch(() => null);
  if (!data || !data.ok) {
    const desc = data?.description ? String(data.description) : `HTTP ${response.status}`;
    throw new Error(`Failed to get webhook info: ${desc}`);
  }

  const info = data.result || {};
  // Print only useful fields.
  console.log(JSON.stringify({
    url: info.url,
    has_custom_certificate: info.has_custom_certificate,
    pending_update_count: info.pending_update_count,
    last_error_date: info.last_error_date,
    last_error_message: info.last_error_message,
    max_connections: info.max_connections,
    ip_address: info.ip_address,
    allowed_updates: info.allowed_updates,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
