"use client";

import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { BookOpen, LogIn } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            router.push("/");
        } catch (error) {
            console.error("Login error", error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full glass p-10 rounded-3xl border border-white/50 space-y-8 text-center shadow-2xl">
                <div className="space-y-4">
                    <div className="w-20 h-20 bg-linear-to-br from-brand-purple to-brand-pink rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-brand-purple/20">
                        <BookOpen className="text-white w-10 h-10" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 leading-tight">Hoş Geldiniz</h1>
                        <p className="text-slate-500 font-medium">Dergi Arşivi platformuna giriş yapın.</p>
                    </div>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 flex items-center justify-center gap-4 hover:bg-slate-50 transition-all shadow-lg active:scale-95 group"
                >
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                    <span className="text-slate-700 font-bold">Google ile Giriş Yap</span>
                </button>

                <p className="text-xs text-slate-400 font-medium pt-4">
                    Giriş yaparak kullanım koşullarını ve gizlilik politikasını kabul etmiş olursunuz.
                </p>
            </div>
        </div>
    );
}
