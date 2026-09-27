import type { Metadata } from "next";
import AuthScreen from "@/components/auth-screen";
export const metadata: Metadata = { title: "Register | RuleX" };
export default function RegisterPage() { return <AuthScreen mode="register" />; }
