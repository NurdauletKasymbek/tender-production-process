import * as crypto from 'crypto';

/**
 * Telegram Mini App initData валидациясы
 * Құжаттама: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Алгоритм:
 *   secret_key = HMAC_SHA256(bot_token, "WebAppData")
 *   data_check_string = алфавит бойынша сұрыпталған "key=value" жолдары \n арқылы біріктірілген
 *   hash = HMAC_SHA256(data_check_string, secret_key) — initData ішіндегі hash-пен сәйкес болуы керек
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
): { valid: boolean; user?: any; authDate?: number } {
  if (!initData || !botToken) return { valid: false };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { valid: false };
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return { valid: false };

  const userRaw = params.get('user');
  const authDate = parseInt(params.get('auth_date') || '0', 10);

  return {
    valid: true,
    user: userRaw ? JSON.parse(userRaw) : null,
    authDate,
  };
}
