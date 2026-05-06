/**
 * Telegram WebApp SDK обертка.
 * `telegram-web-app.js` index.html-ден жүктелетіндіктен `window.Telegram.WebApp`
 * арқылы жұмыс істейміз. Браузерде ашқанда (даму режимінде) — заглушка қайтарамыз.
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export const tg = (): any | null => window.Telegram?.WebApp ?? null;

export const isTelegramApp = (): boolean => {
  const w = tg();
  return !!w && typeof w.initData === 'string' && w.initData.length > 0;
};

export function initTelegram() {
  const w = tg();
  if (!w) return;
  try {
    w.ready?.();
    w.expand?.();
    w.setHeaderColor?.('secondary_bg_color');
    w.enableClosingConfirmation?.();
  } catch {
    // ignore
  }
}

export function getInitData(): string {
  return tg()?.initData ?? '';
}

export function getTelegramUser(): { id: number; first_name?: string; last_name?: string; username?: string } | null {
  return tg()?.initDataUnsafe?.user ?? null;
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  tg()?.HapticFeedback?.impactOccurred?.(style);
}

export function hapticNotify(type: 'error' | 'success' | 'warning' = 'success') {
  tg()?.HapticFeedback?.notificationOccurred?.(type);
}

export function showAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const w = tg();
    if (w?.showAlert) w.showAlert(message, () => resolve());
    else { alert(message); resolve(); }
  });
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const w = tg();
    if (w?.showConfirm) w.showConfirm(message, (ok: boolean) => resolve(ok));
    else resolve(window.confirm(message));
  });
}

export function setMainButton(opts: {
  text: string;
  onClick: () => void;
  show?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  const mb = tg()?.MainButton;
  if (!mb) return () => {};
  mb.setText(opts.text);
  mb.offClick();
  mb.onClick(opts.onClick);
  if (opts.disabled) mb.disable(); else mb.enable();
  if (opts.loading) mb.showProgress?.(); else mb.hideProgress?.();
  if (opts.show !== false) mb.show(); else mb.hide();
  return () => { mb.offClick(); mb.hide(); };
}

export function hideMainButton() {
  tg()?.MainButton?.hide?.();
}

export function setBackButton(onClick: (() => void) | null) {
  const bb = tg()?.BackButton;
  if (!bb) return () => {};
  bb.offClick();
  if (onClick) {
    bb.onClick(onClick);
    bb.show();
  } else {
    bb.hide();
  }
  return () => { bb.offClick(); bb.hide(); };
}
