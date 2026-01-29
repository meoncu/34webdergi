"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    MessageSquare,
    Ticket,
    Settings,
    Users,
    BookOpen,
    Search,
    LogOut,
    ChevronRight
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const menuItems = [
    {
        group: "MENÜ", items: [
            { name: "Panel", icon: LayoutDashboard, href: "/" },
        ]
    },
    {
        group: "YÖNETİM", items: [
            { name: "Abonelik Yönetimi", icon: Users, href: "/admin/subscriptions" },
            { name: "İçerik Yönetimi", icon: BookOpen, href: "/admin/articles" },
        ]
    }
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/login");
        } catch (error) {
            console.error("Logout error", error);
        }
    };

    return (
        <aside className="w-64 border-r border-slate-200 bg-white min-h-screen flex flex-col">
            <div className="p-6">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-brand-purple rounded-lg flex items-center justify-center">
                        <BookOpen className="text-white w-5 h-5" />
                    </div>
                    <span className="text-2xl font-bold italic text-brand-purple tracking-tight">dergi</span>
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-8">
                {menuItems.map((group) => (
                    <div key={group.group}>
                        <h3 className="px-4 text-[10px] font-bold text-slate-400 tracking-wider mb-4">
                            {group.group}
                        </h3>
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group",
                                            isActive
                                                ? "bg-brand-purple/5 text-brand-purple"
                                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className={cn("w-5 h-5", isActive ? "text-brand-purple" : "text-slate-400 group-hover:text-slate-600")} />
                                            <span className="text-sm font-medium">{item.name}</span>
                                        </div>
                                        {group.group === "YÖNETİM" && (
                                            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-slate-500 hover:text-red-500 transition-colors w-full group"
                >
                    <LogOut className="w-5 h-5 group-hover:text-red-500" />
                    <span className="text-sm font-medium">Kilitle / Çıkış</span>
                </button>
            </div>
        </aside>
    );
}
