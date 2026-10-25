import { GuestWalletPanel } from "@/components/guest-wallet-panel";
import { getTranslations, localizeMetadata } from "@/lib/i18n/server";
import styles from "@/components/guest-wallet-panel.module.css";

export async function generateMetadata() {
  return localizeMetadata({ title: "Guest wallet", robots: { index: false, follow: false } });
}

export default async function GuestWalletPage() {
  const t = await getTranslations();
  return <div className={styles.page}><h1>{t("Save or restore wallet")}</h1><GuestWalletPanel/></div>;
}
