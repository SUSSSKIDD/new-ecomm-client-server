/**
 * Single source of truth for order status labels, colors, and steps.
 * Replaces 3 duplicate status maps across AdminOrders, OrderList, AdminDashboard.
 */
export const STATUS_MAP = {
  PENDING:      { label: 'Pending',      color: 'bg-yellow-100 text-yellow-700', step: 0 },
  CONFIRMED:    { label: 'Confirmed',    color: 'bg-blue-100 text-blue-700',     step: 1 },
  ORDER_PICKED: { label: 'Order Packed', color: 'bg-orange-100 text-orange-700', step: 2 },
  SHIPPED:      { label: 'Shipped',      color: 'bg-purple-100 text-purple-700', step: 3 },
  DELIVERED:    { label: 'Delivered',     color: 'bg-green-100 text-green-700',   step: 4 },
  CANCELLED:    { label: 'Cancelled',    color: 'bg-red-100 text-red-700',       step: -1 },
  // Legacy
  PROCESSING:   { label: 'Processing',   color: 'bg-indigo-100 text-indigo-700', step: 1 },
};

export const getStatusLabel = (status) => STATUS_MAP[status]?.label || status;
export const getStatusColor = (status) => STATUS_MAP[status]?.color || 'bg-gray-100 text-gray-700';
export const getStatusStep  = (status) => STATUS_MAP[status]?.step ?? 0;
