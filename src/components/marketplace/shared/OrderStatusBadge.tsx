import { LIFECYCLE_ESTADO_LABELS, LIFECYCLE_ESTADO_COLORS, OrderLifecycleEstado } from '../../../lib/api/marketplace-orders';

// Etiquetas específicas para la vista del instalador
const INSTALLER_ESTADO_LABELS: Record<OrderLifecycleEstado, string> = {
  ...LIFECYCLE_ESTADO_LABELS,
  shipped:   'En tránsito',
  delivered: 'Recibido',
};

interface OrderStatusBadgeProps {
  estado: OrderLifecycleEstado;
  installerView?: boolean;
  size?: 'sm' | 'md';
}

export default function OrderStatusBadge({ estado, installerView = false, size = 'sm' }: OrderStatusBadgeProps) {
  const label  = installerView ? INSTALLER_ESTADO_LABELS[estado] : LIFECYCLE_ESTADO_LABELS[estado];
  const colors = LIFECYCLE_ESTADO_COLORS[estado] ?? 'bg-slate-100 text-slate-600';
  const px     = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${px} ${colors}`}>
      {label}
    </span>
  );
}

export { INSTALLER_ESTADO_LABELS };
