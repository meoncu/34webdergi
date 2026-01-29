"use client";

import { useState, useEffect } from "react";
import {
    Activity as ActivityIcon,
    Users,
    BookOpen,
    Heart,
    MessageSquare,
    Search,
    Eye,
    TrendingUp,
    Clock,
    User as UserIcon,
    ChevronRight,
    Loader2,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { analyticsService } from "@/lib/analytics";
import { userService } from "@/lib/user";
import { Activity, User } from "@/types";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function AnalyticsDashboard() {
    const router = useRouter();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<'activities' | 'users' | 'articles'>('activities');

    // User detail states
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userActivities, setUserActivities] = useState<Activity[]>([]);
    const [isFetchingUserActs, setIsFetchingUserActs] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const userData = await userService.getUser(user.uid);
                    if (userData?.role !== 'admin') {
                        router.push("/");
                    } else {
                        fetchData();
                    }
                } else {
                    router.push("/login");
                }
            });
        };

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [acts, usrs] = await Promise.all([
                    analyticsService.getRecentActivities(100),
                    userService.getAllUsers()
                ]);
                setActivities(acts);
                setUsers(usrs);
            } catch (error) {
                console.error("Fetch analytics error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    const handleUserDetail = async (user: User) => {
        setSelectedUser(user);
        setIsFetchingUserActs(true);
        try {
            const acts = await analyticsService.getUserActivities(user.uid);
            setUserActivities(acts);
        } catch (error) {
            console.error("Fetch user activities error:", error);
        } finally {
            setIsFetchingUserActs(false);
        }
    };

    // Derived Stats
    const totalReads = activities.filter(a => a.type === 'read').length;
    const totalLikes = activities.filter(a => a.type === 'like').length;
    const totalComments = activities.filter(a => a.type === 'comment').length;

    // Article based stats
    const articleStats = activities.reduce((acc, act) => {
        if (!act.articleId) return acc;
        if (!acc[act.articleId]) {
            acc[act.articleId] = { id: act.articleId, title: act.articleTitle, reads: 0, likes: 0, comments: 0 };
        }
        if (act.type === 'read') acc[act.articleId].reads += 1;
        if (act.type === 'like') acc[act.articleId].likes += 1;
        if (act.type === 'comment') acc[act.articleId].comments += 1;
        return acc;
    }, {} as Record<string, any>);

    const topArticles = Object.values(articleStats).sort((a, b) => b.reads - a.reads).slice(0, 10);

    const filteredUsers = users.filter(u =>
        u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-12 h-12 text-brand-purple animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Analiz Paneli</h1>
                    <p className="text-slate-500 font-medium">Kullanıcı etkileşimlerini ve popüler içerikleri takip edin.</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                    {(['activities', 'users', 'articles'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize",
                                activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            {tab === 'activities' ? 'Son Hareketler' : tab === 'users' ? 'Kullanıcılar' : 'Popüler Yazılar'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Toplam Okunma', value: totalReads, icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Toplam Beğeni', value: totalLikes, icon: Heart, color: 'text-red-500', bg: 'bg-red-50' },
                    { label: 'Yorumlar', value: totalComments, icon: MessageSquare, color: 'text-brand-purple', bg: 'bg-brand-purple/5' },
                    { label: 'Aktif Kullanıcı', value: users.length, icon: Users, color: 'text-brand-orange', bg: 'bg-brand-orange/5' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg)}>
                            <stat.icon className={cn("w-6 h-6", stat.color)} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {activeTab === 'activities' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <h2 className="text-xl font-black">Canlı Akış</h2>
                        <ActivityIcon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="divide-y divide-slate-50">
                        {activities.map((act) => (
                            <div key={act.id} className="p-6 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                    act.type === 'read' ? "bg-blue-50 text-blue-500" :
                                        act.type === 'like' ? "bg-red-50 text-red-500" :
                                            act.type === 'comment' ? "bg-purple-50 text-purple-500" : "bg-slate-50 text-slate-500"
                                )}>
                                    {act.type === 'read' ? <Eye className="w-5 h-5" /> :
                                        act.type === 'like' ? <Heart className="w-5 h-5" /> :
                                            act.type === 'comment' ? <MessageSquare className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium">
                                        <span className="font-bold text-slate-900">{act.userName}</span>
                                        <span className="text-slate-500"> {
                                            act.type === 'read' ? 'bir yazı okudu' :
                                                act.type === 'like' ? 'bir yazıyı beğendi' :
                                                    act.type === 'comment' ? 'yorum yaptı' : 'giriş yaptı'
                                        }</span>
                                    </p>
                                    {act.articleTitle && (
                                        <p className="text-sm font-bold text-brand-purple line-clamp-1 italic">
                                            "{act.articleTitle}"
                                        </p>
                                    )}
                                    {act.content && (
                                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-2xl italic border border-slate-100">
                                            "{act.content}"
                                        </p>
                                    )}
                                </div>
                                <div className="text-right whitespace-nowrap">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {act.timestamp?.toDate?.() ? new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(act.timestamp.toDate()) : 'Az önce'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Kullanıcı ara (isim veya e-posta)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-6 text-sm focus:ring-2 focus:ring-brand-purple/20 shadow-sm outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredUsers.map((user) => (
                            <div key={user.uid} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt={user.displayName} />
                                        ) : (
                                            <UserIcon className="w-6 h-6 text-slate-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 items-start">
                                        <p className="font-bold text-slate-900 leading-tight">{user.displayName || 'İsimsiz'}</p>
                                        <p className="text-xs text-slate-500">{user.email}</p>
                                    </div>
                                    <span className={cn(
                                        "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                        user.role === 'admin' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                                    )}>
                                        {user.role}
                                    </span>
                                </div>
                                <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {user.lastLogin?.toDate?.() ? new Intl.DateTimeFormat('tr-TR').format(user.lastLogin.toDate()) : 'Bilinmiyor'}
                                    </span>
                                    <button
                                        onClick={() => handleUserDetail(user)}
                                        className="text-brand-purple hover:underline font-bold"
                                    >
                                        Detay Gör
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'articles' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Yazı Başlığı</th>
                                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Okuma</th>
                                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Beğeni</th>
                                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Yorum</th>
                                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {topArticles.map((article) => (
                                <tr key={article.id} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="p-6">
                                        <p className="font-bold text-slate-900 line-clamp-1">{article.title}</p>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-bold text-sm">
                                            {article.reads}
                                        </span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full font-bold text-sm">
                                            {article.likes}
                                        </span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full font-bold text-sm">
                                            {article.comments}
                                        </span>
                                    </td>
                                    <td className="p-6 text-right">
                                        <Link href={`/article/${article.id}`} className="text-slate-400 hover:text-brand-purple transition-colors">
                                            <ChevronRight className="w-5 h-5 ml-auto" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* User Activity Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setSelectedUser(null)}
                    />
                    <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                    {selectedUser.photoURL ? (
                                        <img src={selectedUser.photoURL} alt={selectedUser.displayName} className="w-full h-full object-cover" />
                                    ) : (
                                        <UserIcon className="w-6 h-6 text-slate-400" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedUser.displayName}</h3>
                                    <p className="text-sm text-slate-500 font-medium">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Son Hareketler</h4>

                            {isFetchingUserActs ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-8 h-8 text-brand-purple animate-spin" />
                                    <p className="text-slate-400 font-bold text-sm">Veriler çekiliyor...</p>
                                </div>
                            ) : userActivities.length === 0 ? (
                                <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                    <p className="text-slate-400 font-medium">Bu kullanıcıya ait henüz bir hareket bulunmuyor.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {userActivities.map((act) => (
                                        <div key={act.id} className="flex gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                                act.type === 'read' ? "bg-blue-100 text-blue-600" :
                                                    act.type === 'like' ? "bg-red-100 text-red-600" :
                                                        act.type === 'comment' ? "bg-purple-100 text-purple-600" : "bg-slate-200 text-slate-600"
                                            )}>
                                                {act.type === 'read' ? <Eye className="w-5 h-5" /> :
                                                    act.type === 'like' ? <Heart className="w-5 h-5" /> :
                                                        act.type === 'comment' ? <MessageSquare className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-bold text-slate-900">
                                                        {act.type === 'read' ? 'Yazı Okundu' :
                                                            act.type === 'like' ? 'Yazı Beğenildi' :
                                                                act.type === 'comment' ? 'Yorum Yapıldı' : 'Giriş Yapıldı'}
                                                    </p>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">
                                                        {act.timestamp?.toDate?.() ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(act.timestamp.toDate()) : 'Az önce'}
                                                    </span>
                                                </div>
                                                {act.articleTitle && (
                                                    <p className="text-xs font-medium text-brand-purple line-clamp-1 italic">
                                                        "{act.articleTitle}"
                                                    </p>
                                                )}
                                                {act.content && (
                                                    <p className="text-xs text-slate-500 bg-white p-2 rounded-xl mt-1 border border-slate-100">
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
            )}
        </div>
    );
}
