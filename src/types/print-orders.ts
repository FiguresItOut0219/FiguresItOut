export const orderStatuses = {
  awaiting_design: '待客户设计', pending_review: '待审核', needs_revision: '待修改',
  approved: '待生产', producing: '生产中', shipped: '已发货', completed: '已完成', cancelled: '已取消',
} as const
export type OrderStatus = keyof typeof orderStatuses
export interface Customer { id: string; name: string; company: string; contact: string; note: string; createdAt: string }
export interface OrderEvent { id: string; at: string; text: string; actor: '后台' | '客户' | '系统' }
export interface PrintOrder {
  id: string; customerId: string; title: string; product: string; quantity: number; dueDate: string;
  note: string; status: OrderStatus; designId?: string; designVersion: number; createdAt: string; updatedAt: string;
  tracking?: string; history: OrderEvent[]; demo?: boolean
}
export interface DesignSpec { width: number; height: number; dpi: number; transparent: boolean; name: string }
export interface PrintDesign {
  id: string; orderId: string; version: number; spec: DesignSpec; pixels: {width: number; height: number};
  source: Record<string, unknown>; png: Blob; preview: Blob; warnings: string[]; submittedAt: string;
}
export interface DesignSubmission extends Omit<PrintDesign, 'id' | 'version' | 'submittedAt'> { expectedDesignId?: string }
export type NewOrder = Pick<PrintOrder, 'customerId' | 'title' | 'product' | 'quantity' | 'dueDate' | 'note'>
export const editableStatuses: OrderStatus[] = ['awaiting_design', 'needs_revision', 'pending_review']
export const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  awaiting_design: ['cancelled'], pending_review: ['approved', 'needs_revision', 'cancelled'],
  needs_revision: ['cancelled'], approved: ['producing', 'cancelled'], producing: ['shipped'], shipped: ['completed'],
}
