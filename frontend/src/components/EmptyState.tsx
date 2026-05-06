interface Props {
  icon?: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon = '📭', title, description }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden>{icon}</div>
      <div className="empty-state__title">{title}</div>
      {description && <div className="empty-state__desc">{description}</div>}
    </div>
  );
}
