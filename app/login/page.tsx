import type { Metadata } from "next";
import AuthScreen from "@/components/auth-screen";
export const metadata: Metadata = { title: "Sign in | RuleX" };
export default function LoginPage() { return <AuthScreen mode="login" />; }
