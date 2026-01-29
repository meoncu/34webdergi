"use client";

import { useState, useEffect } from "react";
import {
    User as UserIcon,
    Mail,
    Shield,
    Clock,
    BookMarked,
    Heart,
    Eye,
    Settings,
    Loader2,
    Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { analyticsService } from "@/lib/analytics";
import { userService } from "@/lib/user";
import { User, Activity } from "@/types";

export default function ProfilePage() {
    const [firebaseUser, setFirebaseUser] = useState<any>(null);
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState({
        reads: 0,
        likes: 0,
        bookmarks: 0
    });
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
            setFirebaseUser(fUser);
            if (fUser) {
                try {
                    // Try to get synced data, but fallback to sync if missing
                    let userData = await userService.getUser(fUser.uid);

                    if (!userData) {
                        // If user exists in Auth but not in DB, sync them now
                        userData = await userService.syncUser(fUser);
                    }

                    if (userData) {
                        setUser(userData);
                    } else {
                        // Absolute fallback to just the Auth data to avoid "Not Logged In" screen
                        setUser({
                            uid: fUser.uid,
                            email: fUser.email || "",
                            displayName: fUser.displayName || "Kullanıcı",
                            photoURL: fUser.photoURL || "",
                            role: 'user'
                        } as any);
                    }

                    // Fetch user specific stats
                    const [userActivities, bookmarks] = await Promise.all([
                        analyticsService.getUserActivities(fUser.uid),
                        analyticsService.getUserBookmarks(fUser.uid)
                    ]);

                    setActivities(userActivities.slice(0, 10)); // Last 10
                    setStats({
                        reads: userActivities.filter(a => a.type === 'read').length,
                        likes: userActivities.filter(a => a.type === 'like').length,
                        bookmarks: bookmarks.length
                    });
                } catch (error) {
                    console.error("Profile fetch error:", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setUser(null);
                setIsLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-brand-purple animate-spin" />
            </div>
        );
    }

    if (!firebaseUser || !user) {
        return (
            <div className="max-w-md mx-auto text-center py-20 space-y-6">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <UserIcon className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-black text-slate-900">Profil</h1>
                <p className="text-slate-500 font-medium">Profilinizi görüntülemek için giriş yapmalısınız.</p>
                <a href="/login" className="inline-block bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all">
                    Giriş Yap
                </a>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Header / Cover */}
            <div className="relative h-48 bg-linear-to-br from-brand-purple to-brand-pink rounded-[2.5rem] overflow-hidden shadow-xl shadow-brand-purple/10">
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
                <div className="absolute -bottom-12 left-8 md:flex items-end gap-6">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-3xl bg-white p-1.5 shadow-2xl">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName} className="w-full h-full rounded-[1.2rem] object-cover" />
                            ) : (
                                <div className="w-full h-full rounded-[1.2rem] bg-slate-100 flex items-center justify-center">
                                    <UserIcon className="w-12 h-12 text-slate-300" />
                                </div>
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 border-4 border-white rounded-full shadow-lg" />
                    </div>
                    <div className="pb-16 hidden md:block">
                        <h1 className="text-3xl font-black text-white drop-shadow-md">{user.displayName}</h1>
                        <p className="text-white/80 font-bold flex items-center gap-2">
                            <Mail className="w-4 h-4" /> {user.email}
                        </p>
                    </div>
                </div>
            </div>

            {/* Mobile Info */}
            <div className="pt-14 md:hidden text-center space-y-2">
                <h1 className="text-2xl font-black text-slate-900">{user.displayName}</h1>
                <p className="text-slate-500 font-medium text-sm flex items-center justify-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> {user.email}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
                {/* Left: Stats & Info */}
                <div className="space-y-6 lg:col-span-1">
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Etkinlikler</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-slate-600 font-bold">
                                        <Eye className="w-5 h-5 text-blue-500" /> Okuma
                                    </div>
                                    <span className="text-lg font-black">{stats.reads}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-slate-600 font-bold">
                                        <Heart className="w-5 h-5 text-red-500" /> Beğeni
                                    </div>
                                    <span className="text-lg font-black">{stats.likes}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-slate-600 font-bold">
                                        <BookMarked className="w-5 h-5 text-brand-purple" /> Kaydedilen
                                    </div>
                                    <span className="text-lg font-black">{stats.bookmarks}</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-slate-50" />

                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Hesap Bilgileri</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Shield className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rol</p>
                                        <p className="text-sm font-bold text-slate-700 capitalize">{user.role}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Son Giriş</p>
                                        <p className="text-sm font-bold text-slate-700">
                                            {user.lastLogin?.toDate?.() ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(user.lastLogin.toDate()) : 'Bugün'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                <Clock className="w-6 h-6 text-brand-purple" /> Son Hareketlerim
                            </h3>
                        </div>

                        {activities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2">
                                <Clock className="w-12 h-12 opacity-20" />
                                <p className="font-bold">Henüz bir etkinlik bulunmuyor.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-4 before:w-px before:bg-slate-50">
                                {activities.map((act) => (
                                    <div key={act.id} className="relative pl-12 group">
                                        <div className={cn(
                                            "absolute left-2.5 top-0 w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-1/2 mt-1.5 transition-all group-hover:scale-125 z-10",
                                            act.type === 'read' ? "bg-blue-500" :
                                                act.type === 'like' ? "bg-red-500" :
                                                    act.type === 'comment' ? "bg-brand-purple" : "bg-slate-300"
                                        )} />
                                        <div className="space-y-1 text-left">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-slate-500">
                                                    {act.type === 'read' ? 'Bir yazı okudunuz' :
                                                        act.type === 'like' ? 'Bir yazıyı beğendiniz' :
                                                            act.type === 'comment' ? 'Bir yazıya yorum yaptınız' : 'Giriş yaptınız'}
                                                </p>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                    {act.timestamp?.toDate?.() ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(act.timestamp.toDate()) : 'Bugün'}
                                                </span>
                                            </div>
                                            {act.articleTitle && (
                                                <p className="font-black text-slate-900 group-hover:text-brand-purple transition-colors leading-tight">
                                                    {act.articleTitle}
                                                </p>
                                            )}
                                            {act.content && (
                                                <p className="text-sm italic text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100 mt-2">
                                                    "{act.content}"
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
