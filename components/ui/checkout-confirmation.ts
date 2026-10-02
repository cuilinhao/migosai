export type CheckoutOrder = { id: string; credits: number; status: string };

export function confirmedCheckout(orders: CheckoutOrder[], orderId: string): CheckoutOrder | null {
  return orders.find((order) => order.id === orderId && order.status === "paid") ?? null;
}
