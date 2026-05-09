/**
 * Telegram WebApp SDK обертка.
 * `telegram-web-app.js` index.html-ден жүктелетіндіктен `window.Telegram.WebApp`
 * браузерде де бар, бірақ методтарының көбі "WebAppMethodUnsupported" қателікпен
 * құлайды (нұсқа 6.0). Сол себептен барлық шақыруларды `isTelegramApp()` арқылы
 * сүзгілеп, browser-де native fallback қолданамыз.
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export const tg = (): any | null => window.Telegram?.WebApp ?? null;

/**
 * Шынайы Telegram Mini App-та жүрміз ғ-ма? `initData` бос емес болуы керек —
 * Telegram-нан ашқанда ғана толтырылады.
 */
export const isTelegramApp = (): boolean => {
  const w = tg();
  return !!w && typeof w.initData === 'string' && w.initData.length > 0;
};

const safe = <T>(fn: () => T): T | undefined => {
  try { return fn(); } catch { return undefined; }
};

export function initTelegram() {
  if (!isTelegramApp()) return;
  const w = tg();
  safe(() => w.ready?.());
  safe(() => w.expand?.());
  safe(() => w.setHeaderColor?.('secondary_bg_color'));
  safe(() => w.enableClosingConfirmation?.());
}

export function getInitData(): string {
  return tg()?.initData ?? '';
}

export function getTelegramUser(): { id: number; first_name?: string; last_name?: string; username?: string } | null {
  return tg()?.initDataUnsafe?.user ?? null;
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isTelegramApp()) return;
  safe(() => tg()?.HapticFeedback?.impactOccurred?.(style));
}

export function hapticNotify(type: 'error' | 'success' | 'warning' = 'success') {
  if (!isTelegramApp()) return;
  safe(() => tg()?.HapticFeedback?.notificationOccurred?.(type));
}

export function showAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    if (isTelegramApp()) {
      const w = tg();
      try {
        w.showAlert(message, () => resolve());
        return;
      } catch {
        // Telegram нұсқасы көтермейді — fallback
      }
    }
    alert(message);
    resolve();
  });
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (isTelegramApp()) {
      const w = tg();
      try {
        w.showConfirm(message, (ok: boolean) => resolve(ok));
        return;
      } catch {
        // Telegram нұсқасы көтермейді — fallback
      }
    }
    resolve(window.confirm(message));
  });
}

export function setMainButton(opts: {
  text: string;
  onClick: () => void;
  show?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  if (!isTelegramApp()) return () => {};
  const mb = tg()?.MainButton;
  if (!mb) return () => {};
  return safe(() => {
    mb.setText(opts.text);
    mb.offClick();
    mb.onClick(opts.onClick);
    if (opts.disabled) mb.disable(); else mb.enable();
    if (opts.loading) mb.showProgress?.(); else mb.hideProgress?.();
    if (opts.show !== false) mb.show(); else mb.hide();
    return () => { safe(() => { mb.offClick(); mb.hide(); }); };
  }) ?? (() => {});
}

export function hideMainButton() {
  if (!isTelegramApp()) return;
  safe(() => tg()?.MainButton?.hide?.());
}

export function setBackButton(onClick: (() => void) | null) {
  if (!isTelegramApp()) return () => {};
  const bb = tg()?.BackButton;
  if (!bb) return () => {};
  return safe(() => {
    bb.offClick();
    if (onClick) {
      bb.onClick(onClick);
      bb.show();
    } else {
      bb.hide();
    }
    return () => { safe(() => { bb.offClick(); bb.hide(); }); };
  }) ?? (() => {});
}
