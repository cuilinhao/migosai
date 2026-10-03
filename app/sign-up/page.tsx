import { localizeMetadata } from "@/lib/i18n/server";
import { AuthPage } from "@/components/ui/auth-page";

export async function generateMetadata() { return localizeMetadata({ title: "Sign Up" }); }

export default function SignUpPage() { return <AuthPage kind="sign-up" />; }
