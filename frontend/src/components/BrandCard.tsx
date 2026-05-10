import { useState } from 'react';

/**
 * Бот стиліндегі үлкен компания карточкасы (логотип).
 *
 * Логотип файлы: `frontend/public/sert-logo.png` (немесе .svg)
 * Vite оны түбір директорияға (`/sert-logo.png`) шығарады.
 * Файл жоқ болса — мәтіндік fallback көрсетіледі.
 */
export function BrandCard() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="brand-card">
      <div className="brand-card__inner">
        {imgFailed ? (
          <>
            <div className="brand-card__logo">
              <span className="brand-card__name">sert</span>
            </div>
            <div className="brand-card__sub">өндірістік компания</div>
          </>
        ) : (
          <img
            src="/sert-logo.png"
            alt="SERT өндірістік компания"
            className="brand-card__img"
            onError={() => setImgFailed(true)}
          />
        )}
      </div>
    </div>
  );
}
