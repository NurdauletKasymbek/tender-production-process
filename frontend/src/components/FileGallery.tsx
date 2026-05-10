import { useCallback, useEffect, useRef, useState } from 'react';
import { filesApi } from '../api/endpoints';
import type { FileType, OrderFile } from '../types';
import { hapticImpact, hapticNotify } from '../utils/telegram';
import { formatDateTime } from '../utils/labels';

const FILE_TYPE_LABEL: Record<FileType, string> = {
  CONTRACT: 'Келісімшарт',
  TECHNICAL_SPEC: 'Техникалық тапсырма',
  PRODUCTION_PHOTO: 'Өндіріс фотосы',
  PACKAGING_PHOTO: 'Қаптау фотосы',
  LOADING_PHOTO: 'Тиеу фотосы',
  DELIVERY_PHOTO: 'Жеткізу фотосы',
  INVOICE: 'Шот-фактура',
  OTHER: 'Басқа',
};

interface Props {
  orderId: string;
  /** Қазіргі кезеңге қарап ұсынылатын файл түрі */
  suggestedType?: FileType;
  /** Жүктеу мүмкіндігі бар-жоғы */
  canUpload?: boolean;
  /** Файл жүктелгенде/жойылғанда parent-ке хабарлау */
  onChange?: () => void;
}

export function FileGallery({ orderId, suggestedType = 'OTHER', canUpload = true, onChange }: Props) {
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<FileType>(suggestedType);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await filesApi.list(orderId));
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Файлдарды жүктеу қатесі');
    } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => { setType(suggestedType); }, [suggestedType]);

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      hapticImpact('light');
      await filesApi.upload({ orderId, file, fileType: type });
      hapticNotify('success');
      await reload();
      onChange?.();
    } catch (err: any) {
      hapticNotify('error');
      setError(err.message || 'Жүктеу қатесі');
    } finally { setUploading(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Файлды жоямыз ба?')) return;
    try {
      await filesApi.remove(id);
      setFiles((p) => p.filter((f) => f.id !== id));
      onChange?.();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Жою қатесі';
      setError(msg);
    }
  };

  const isImage = (m: string) => m.startsWith('image/');

  return (
    <div className="files">
      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      {canUpload && (
        <div className="card files__upload">
          <div className="field">
            <span className="field__label">Файл түрі</span>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as FileType)}
            >
              {(Object.keys(FILE_TYPE_LABEL) as FileType[]).map((k) => (
                <option key={k} value={k}>{FILE_TYPE_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn--soft btn--block"
            onClick={onPick}
            disabled={uploading}
          >
            {uploading ? 'Жүктелуде...' : (
              <>
                <span aria-hidden>📎</span>
                <span>Файл таңдау (фото немесе PDF)</span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={onFile}
          />
          <div className="field__hint">JPG, PNG, WEBP, HEIC немесе PDF · 10 MB-қа дейін</div>
        </div>
      )}

      {loading ? (
        <div className="muted" style={{ padding: 12 }}>Жүктелуде...</div>
      ) : files.length === 0 ? (
        <div className="muted" style={{ padding: 12 }}>Әлі файл жоқ</div>
      ) : (
        <div className="files__grid">
          {files.map((f) => {
            const url = filesApi.downloadUrl(f.id, true);
            return (
              <div key={f.id} className="file-card">
                <a href={url} target="_blank" rel="noreferrer" className="file-card__media">
                  {isImage(f.mimeType) ? (
                    <img src={url} alt={f.fileName} loading="lazy" />
                  ) : (
                    <div className="file-card__pdf">
                      <span aria-hidden>📄</span>
                      <span className="file-card__ext">PDF</span>
                    </div>
                  )}
                </a>
                <div className="file-card__body">
                  <div className="file-card__type">{FILE_TYPE_LABEL[f.fileType]}</div>
                  <div className="file-card__name" title={f.fileName}>{f.fileName}</div>
                  <div className="file-card__meta">
                    {f.uploadedBy?.fullName} · {formatDateTime(f.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  className="file-card__remove"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void remove(f.id);
                  }}
                  aria-label="Жою"
                  title="Жою"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
