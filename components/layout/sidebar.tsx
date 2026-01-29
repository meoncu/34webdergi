"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    MessageSquare,
    Ticket,
    Settings,
    Users,
    BookOpen,
    BookMarked,
    Search,
    LogOut,
    ChevronRight,
    Menu,
    X,
    BarChart3,
    User as UserIcon,
    LogIn
} from "lucide-react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { userService } from "@/lib/user";

const menuItems = [
    {
        group: "MENÜ", items: [
            { name: "Panel", icon: LayoutDashboard, href: "/" },
            { name: "Kaydedilenler", icon: BookMarked, href: "/bookmarks" },
        ]
    },
    {
        group: "YÖNETİM", items: [
            { name: "Abonelik Yönetimi", icon: Users, href: "/admin/subscriptions" },
            { name: "İçerik Yönetimi", icon: BookOpen, href: "/admin/articles" },
            { name: "Analiz & Kullanıcılar", icon: BarChart3, href: "/admin/analytics" },
        ]
    }
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    // Sayfa değiştiğinde menüyü otomatik kapat (mobilde)
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    const [user, setUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                const userData = await userService.getUser(u.uid);
                setUserRole(userData?.role || 'user');
            } else {
                setUserRole(null);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/login");
        } catch (error) {
            console.error("Logout error", error);
        }
    };

    return (
        <>
            {/* Mobilde Menü Açma Butonu */}
            <button
                onClick={() => setIsOpen(true)}
                className="lg:hidden fixed top-4 left-4 z-40 p-3 bg-white border border-slate-200 rounded-xl shadow-lg text-slate-600 active:scale-95 transition-all"
            >
                <Menu className="w-6 h-6" />
            </button>

            {/* Mobilde Karartma Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-all animate-in fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white flex flex-col transition-all duration-300 transform lg:relative lg:translate-x-0 lg:w-64",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand-purple rounded-lg flex items-center justify-center">
                            <BookOpen className="text-white w-5 h-5" />
                        </div>
                        <span className="text-2xl font-bold italic text-brand-purple tracking-tight">dergi</span>
                    </Link>

                    {/* Mobilde Kapatma Butonu */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden p-2 text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-8 overflow-y-auto">
                    {menuItems.map((group) => {
                        // Admin olmayanlara Yönetim grubunu gösterme
                        if (group.group === "YÖNETİM" && userRole !== 'admin') return null;

                        return (
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
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100 space-y-2">
                    {user ? (
                        <Link
                            href="/profile"
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-2xl transition-all hover:bg-slate-50 group",
                                pathname === "/profile" && "bg-slate-50 border border-slate-100"
                            )}
                        >
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="w-5 h-5 text-slate-400" />
                                )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold text-slate-900 truncate">{user.displayName || 'Kullanıcı'}</p>
                                <p className="text-[10px] font-bold text-slate-400 truncate uppercase mt-0.5 tracking-wider">Profilim</p>
                            </div>
                        </Link>
                    ) : (
                        <Link
                            href="/login"
                            className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-all text-slate-500 font-bold text-sm"
                        >
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <LogIn className="w-5 h-5" />
                            </div>
                            Giriş Yap
                        </Link>
                    )}

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2.5 text-slate-500 hover:text-red-500 transition-colors w-full group"
                    >
                        <LogOut className="w-5 h-5 group-hover:text-red-500" />
                        <span className="text-sm font-medium">Çıkış Yap</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
