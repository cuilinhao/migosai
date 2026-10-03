import { localizeMetadata } from "@/lib/i18n/server";
import { MyOrders } from "@/components/account/account-pages";

export async function generateMetadata() { return localizeMetadata({ title: "My Orders" }); }
export default function MyOrdersPage() { return <MyOrders/>; }
