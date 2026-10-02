import type { Metadata } from "next";
import { MyOrders } from "@/components/account/account-pages";

export const metadata: Metadata = { title: "My Orders" };
export default function MyOrdersPage() { return <MyOrders/>; }
