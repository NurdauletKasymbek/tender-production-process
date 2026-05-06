import { useCallback, useEffect, useState } from 'react';
import { Header } from '../../components/Header';
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

  return (
    <div className="page">
      <Header title="Менің тапсырмаларым" />

      {error && <div className="alert alert--error">{error}</div>}
      {loading ? (
        <Spinner />
      ) : tasks.length === 0 ? (
        <EmptyState icon="🎯" title="Белсенді тапсырма жоқ" description="Жаңа тапсырма келгенде Telegram-нан хабарлама келеді." />
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
