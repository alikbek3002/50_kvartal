// Usage:
//   node scripts/set-telegram-webhook.js https://<your-backend-domain>
// Requires env:
//   TELEGRAM_BOT_TOKEN
// Optional env:
//   TELEGRAM_WEBHOOK_SECRET
//
// This sets Telegram webhook to:
//   <backend>/api/telegram/webhook
// If TELEGRAM_WEBHOOK_SECRET is set, it is passed as Telegram secret_token.

const backendBaseUrl = process.argv[2];

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error('Backend base URL is required');
  if (!/^https?:\/\//i.test(value)) {
    throw new Error('Backend base URL must include protocol, e.g. https://...');
  }
  return value;
}

async function main() {
  const token = requiredEnv('TELEGRAM_BOT_TOKEN');
  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

  const baseUrl = normalizeBaseUrl(backendBaseUrl);
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;

  const payload = {
    url: webhookUrl,
    ...(secret ? { secret_token: secret } : {}),
  };

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!data || !data.ok) {
    const desc = data?.description ? String(data.description) : `HTTP ${response.status}`;
    throw new Error(`Failed to set webhook: ${desc}`);
  }

  console.log('Webhook set successfully');
  console.log('Webhook URL:', webhookUrl);
  console.log('Secret enabled:', Boolean(secret));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
