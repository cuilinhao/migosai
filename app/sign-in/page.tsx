import { localizeMetadata } from "@/lib/i18n/server";
import { AuthPage } from "@/components/ui/auth-page";

export async function generateMetadata() { return localizeMetadata({ title: "Sign In" }); }

export default function SignInPage() { return <AuthPage kind="sign-in" />; }
