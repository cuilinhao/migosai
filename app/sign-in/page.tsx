import type { Metadata } from "next";
import { AuthPage } from "@/components/ui/auth-page";

export const metadata: Metadata = { title: "Sign In" };

export default function SignInPage() { return <AuthPage kind="sign-in" />; }
