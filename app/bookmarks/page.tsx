"use client";

import { useState, useEffect } from "react";
import {
    BookMarked,
    Clock,
    User,
    ArrowRight,
    Loader2,
    Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { articleService } from "@/lib/articles";
import { analyticsService } from "@/lib/analytics";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Article } from "@/types";

export default function BookmarksPage() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchBookmarks = async () => {
            if (!currentUser) {
                setIsLoading(false);
                return;
            }

            try {
                const bookmarkIds = await analyticsService.getUserBookmarks(currentUser.uid);
                if (bookmarkIds.length > 0) {
                    const data = await articleService.getByIds(bookmarkIds);
                    setArticles(data);
                } else {
                    setArticles([]);
                }
            } catch (error: any) {
                console.error("Fetch bookmarks error:", error);
                if (error.message?.includes("index")) {
                    alert("Bu sayfa için bir dizin (index) gerekiyor. Lütfen tarayıcı konsolundaki (F12) linke tıklayarak dizini oluşturun.");
                }
            } finally {
                setIsLoading(false);
            }
        };

        if (currentUser !== undefined) {
            fetchBookmarks();
        }
    }, [currentUser]);

    const filteredArticles = articles.filter(article =>
        article.baslik.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.yazarAdi.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-brand-purple animate-spin" />
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="max-w-2xl mx-auto text-center py-20 space-y-6">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <BookMarked className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-black text-slate-900">Kaydedilen Yazılar</h1>
                <p className="text-slate-500 font-medium">Kaydettiğiniz yazılara erişmek için giriş yapmalısınız.</p>
                <Link href="/login" className="inline-block bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all">
                    Giriş Yap
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200/60 pb-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-brand-purple shadow-sm shadow-brand-purple/50" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Kütüphanem</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kaydedilenler</h1>
                    <p className="text-sm text-slate-500 font-medium">Daha sonra okumak için ayırdığınız içerikler.</p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Kaydedilenlerde ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all"
                    />
                </div>
            </div>

            {filteredArticles.length === 0 ? (
                <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-20 text-center space-y-4">
                    <p className="text-slate-400 font-bold text-lg">
                        {searchTerm ? "Aramanızla eşleşen kayıt bulunamadı." : "Henüz hiçbir yazıyı kaydetmediniz."}
                    </p>
                    {!searchTerm && (
                        <Link href="/" className="text-brand-purple font-bold hover:underline">
                            Yazılara göz atın →
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredArticles.map((article) => (
                        <Link
                            key={article.id}
                            href={`/article/${article.id}`}
                            className="group bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-brand-purple/5 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
                        >
                            <div className="space-y-4 flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="px-3 py-1 bg-brand-purple/5 text-brand-purple text-[10px] font-black uppercase tracking-widest rounded-full">
                                        {article.kategori || "Genel"}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase">{article.ay} {article.yil}</span>
                                    </div>
                                </div>

                                <h2 className="text-xl font-black text-slate-900 leading-tight group-hover:text-brand-purple transition-colors line-clamp-2">
                                    {article.baslik}
                                </h2>
                            </div>

                            <div className="pt-6 mt-6 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                        <User className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 line-clamp-1">{article.yazarAdi}</span>
                                </div>
                                <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-brand-purple group-hover:text-white transition-all">
                                    <ArrowRight className="w-4 h-4" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
