import { useAuth } from '../hooks/useAuth';
import { TenderDepartmentHome } from './roles/TenderDepartmentHome';
import { DirectorHome } from './roles/DirectorHome';
import { ProductionHeadHome } from './roles/ProductionHeadHome';
import { WorkshopHome } from './roles/WorkshopHome';
import { StageQueueHome } from './roles/StageQueueHome';
import { LogisticsHome } from './roles/LogisticsHome';
import { AdminHome } from './roles/AdminHome';

export function HomePage() {
  const { user, effectiveRole } = useAuth();
  if (!user || !effectiveRole) return null;

  switch (effectiveRole) {
    case 'ADMIN': return <AdminHome />;
    case 'TENDER_DEPARTMENT': return <TenderDepartmentHome />;
    case 'DIRECTOR': return <DirectorHome />;
    case 'PRODUCTION_HEAD': return <ProductionHeadHome />;
    case 'WORKSHOP_WORKER': return <WorkshopHome />;
    case 'PACKAGING': return <StageQueueHome stage="PACKAGING" title="Қаптау" />;
    case 'LOADING': return <StageQueueHome stage="LOADING" title="Тиеу" />;
    case 'LOGISTICS': return <LogisticsHome />;
    default: return null;
  }
}
