import type { Metadata } from "next";
import { AuthPage } from "@/components/ui/auth-page";

export const metadata: Metadata = { title: "Sign Up" };

export default function SignUpPage() { return <AuthPage kind="sign-up" />; }
