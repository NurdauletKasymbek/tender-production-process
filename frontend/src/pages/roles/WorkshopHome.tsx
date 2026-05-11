import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardHeader } from '../../components/DashboardHeader';
import { BrandCard } from '../../components/BrandCard';
import { Spinner } from '../../components/Spinner';
import { EmptyState } from '../../components/EmptyState';
import { TaskCard } from '../../components/TaskCard';
import { productionApi } from '../../api/endpoints';
import type { ProductionTask, TaskStatus } from '../../types';
import { hapticImpact, hapticNotify } from '../../utils/telegram';

export function WorkshopHome() {
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await productionApi.myTasks());
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Тапсырмаларды жүктеу қатесі');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const onChange = async (id: string, next: TaskStatus) => {
    try {
      hapticImpact('medium');
      await productionApi.updateTaskStatus(id, next);
      hapticNotify(next === 'COMPLETED' ? 'success' : 'warning');
      await reload();
    } catch (e: any) {
      setError(e.message || 'Күй өзгерту мүмкін болмады');
    }
  };

  const counts = useMemo(() => ({
    pending: tasks.filter((t) => t.status === 'PENDING').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
  }), [tasks]);

  return (
    <div className="page">
      <DashboardHeader />
      <BrandCard />

      {!loading && tasks.length > 0 && (
        <div className="stat-grid stat-grid--3">
          <div className="stat-card">
            <div className="stat-card__icon" aria-hidden>⏸</div>
            <div className="stat-card__value">{counts.pending}</div>
            <div className="stat-card__label">Күтуде</div>
          </div>
          <div className="stat-card stat-card--success">
            <div className="stat-card__icon" aria-hidden>▶</div>
            <div className="stat-card__value">{counts.inProgress}</div>
            <div className="stat-card__label">Орындалуда</div>
          </div>
          <div className="stat-card stat-card--danger">
            <div className="stat-card__icon" aria-hidden>⚠</div>
            <div className="stat-card__value">{counts.blocked}</div>
            <div className="stat-card__label">Кедергі</div>
          </div>
        </div>
      )}

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}
      {loading ? (
        <Spinner />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="Белсенді тапсырма жоқ"
          description="Жаңа тапсырма келгенде Telegram-нан хабарлама келеді."
        />
      ) : (
        <div className="list">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onChangeStatus={(next) => onChange(t.id, next)} />
          ))}
        </div>
      )}
    </div>
  );
}
