"use client";

import { useState } from "react";
import {
    Globe2,
    User,
    Lock,
    RefreshCw,
    Database,
    CheckCircle2,
    AlertCircle,
    Settings,
    ShieldCheck,
    Calendar,
    Hash,
    BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect } from "react";
import { subscriptionService } from "@/lib/subscriptions";
import { articleService } from "@/lib/articles";
import { SubscriptionSite, Article } from "@/types";

import {
    ArrowUpDown,
    Edit2,
    Power,
    X,
    Save,
    Search,
    Filter,
    Eye,
    ExternalLink,
    Trash2
} from "lucide-react";

// Firestore'dan canlı veriler kullanılıyor

export default function AdminArticles() {
    const [subscriptions, setSubscriptions] = useState<SubscriptionSite[]>([]);
    const [selectedSubId, setSelectedSubId] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncResult, setLastSyncResult] = useState<{ success: boolean; count: number; skipped: number } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterYear, setFilterYear] = useState<number | "Tümü">("Tümü");
    const [filterMonth, setFilterMonth] = useState<string | "Tümü">("Tümü");
    const [syncYear, setSyncYear] = useState(2026);
    const [syncMonth, setSyncMonth] = useState("Ocak");
    const [editingArticle, setEditingArticle] = useState<Article | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<Article>>({});

    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<Record<number, Record<string, { count: number; chars: number; words: number }>>>({});
    const [sessionCookie, setSessionCookie] = useState("");
    const [forceScrape, setForceScrape] = useState(false);

    // Cookie'yi localStorage'dan yükle ve kaydet
    useEffect(() => {
        const savedCookie = localStorage.getItem("altinoluk_session_cookie");
        if (savedCookie) setSessionCookie(savedCookie);

        const savedForce = localStorage.getItem("altinoluk_force_scrape");
        if (savedForce === "true") setForceScrape(true);
    }, []);

    useEffect(() => {
        localStorage.setItem("altinoluk_session_cookie", sessionCookie);
    }, [sessionCookie]);

    useEffect(() => {
        localStorage.setItem("altinoluk_force_scrape", String(forceScrape));
    }, [forceScrape]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [subs, arts, statistics] = await Promise.all([
                subscriptionService.getAll(),
                articleService.getAll(50),
                articleService.getStats()
            ]);
            setSubscriptions(subs);
            setArticles(arts);
            setStats(statistics);
            if (subs.length > 0) setSelectedSubId(subs[0].id || "");
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const selectedSub = subscriptions.find(s => s.id === selectedSubId);

    const handleSync = async () => {
        if (!selectedSubId) {
            alert("Lütfen önce bir abonelik seçin.");
            return;
        }

        setIsSyncing(true);
        // Mükerrer kontrolü: Seçilen yıl/ay için zaten kayıt var mı?
        const existingCount = await articleService.countArticlesByPeriod(syncYear, syncMonth);
        if (existingCount > 0) {
            const confirmClear = confirm(`${syncYear} ${syncMonth} dönemine ait sistemde zaten ${existingCount} makale bulunuyor. Temiz bir kurulum için bu makaleleri silip yeniden eklemek ister misiniz?`);
            if (confirmClear) {
                // Mevcutları sil
                await articleService.deleteByPeriod(syncYear, syncMonth);
            } else {
                // Silmeden devam etmek istenmiyorsa işlemi iptal et veya sadece eksikleri ekle?
                // Kullanıcı "kaldır ve yeniden kayıt yap" dediği için silmeyi kabul etmezse durmak daha mantıklı.
                const continueWithoutDelete = confirm("Mevcut makaleleri silmeden sadece eksik olanları mı eklemek istersiniz?");
                if (!continueWithoutDelete) {
                    setIsSyncing(false);
                    return;
                }
            }
        }

        try {
            let sampleArticles: Omit<Article, "id" | "olusturmaTarihi">[] = [];

            // Otomatik Sayı Hesaplama (Ocak 2026 = Sayı 479 referans alınarak)
            const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
            const monthIndex = monthNames.indexOf(syncMonth);
            // 479 - ((2026 - Year) * 12 + (0 - MonthIndex))
            const calculatedIssue = 479 - ((2026 - syncYear) * 12 - monthIndex);

            console.log(`Searching for Issue: ${calculatedIssue} (${syncYear} ${syncMonth})`);

            // Web'den o sayıdaki makaleleri keşfet
            const issueUrl = `https://www.altinoluk.com.tr/arsiv/sayi-${calculatedIssue}`;
            const discoverRes = await fetch(`/api/scrape?url=${encodeURIComponent(issueUrl)}&mode=issue`);

            if (discoverRes.ok) {
                const discoverData = await discoverRes.json();
                if (discoverData.articles && discoverData.articles.length > 0) {
                    console.log(`Found ${discoverData.articles.length} articles on web.`);
                    sampleArticles = discoverData.articles.map((a: any) => ({
                        baslik: a.baslik,
                        yazarAdi: "Yükleniyor...",
                        dergiSayisi: calculatedIssue.toString(),
                        yil: syncYear,
                        ay: syncMonth,
                        yayinTarihi: `${syncYear}-${(monthIndex + 1).toString().padStart(2, '0')}-01`,
                        icerikHTML: "<p>İçerik çekiliyor...</p>",
                        icerikText: "İçerik hazırlanıyor...",
                        kaynakURL: a.kaynakURL
                    }));
                }
            }

            // Fallback (eğer web'den bulunamazsa eski sabit listeyi (sadece Ocak 2026 ise) veya hata ver)
            if (sampleArticles.length === 0) {
                alert(`${syncYear} ${syncMonth} (Sayı: ${calculatedIssue}) dönemi için web'de makale bulunamadı.`);
                setIsSyncing(false);
                return;
            }

            let addedCount = 0;
            let updatedCount = 0;

            for (let art of sampleArticles) {
                // Her makalenin içine girip tam metni al
                if (forceScrape && art.kaynakURL) {
                    try {
                        const scrapeUrl = `/api/scrape?url=${encodeURIComponent(art.kaynakURL)}${sessionCookie ? `&cookie=${sessionCookie}` : ''}`;
                        const scrapeRes = await fetch(scrapeUrl);
                        if (scrapeRes.ok) {
                            const scrapeData = await scrapeRes.json();
                            if (scrapeData.icerikHTML && !scrapeData.error) {
                                art = {
                                    ...art,
                                    baslik: scrapeData.baslik || art.baslik,
                                    yazarAdi: scrapeData.yazarAdi || "Anonim",
                                    icerikHTML: scrapeData.icerikHTML,
                                    icerikText: scrapeData.spot || art.icerikText
                                };
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to scrape ${art.baslik}:`, err);
                    }
                }

                const result = await articleService.upsertArticle(art);
                if (result.type === 'added') addedCount++;
                else updatedCount++;
            }

            await loadData();
            setLastSyncResult({ success: true, count: addedCount, skipped: updatedCount });
        } catch (error) {
            console.error("Sync error:", error);
            setLastSyncResult({ success: false, count: 0, skipped: 0 });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`${syncYear} ${syncMonth} dönemine ait TÜM makaleleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) return;

        setIsSyncing(true);
        try {
            const count = await articleService.deleteByPeriod(syncYear, syncMonth);
            alert(`${count} makale başarıyla silindi.`);
            await loadData();
        } catch (error: any) {
            console.error("Bulk delete error:", error);
            alert(`Silme hatası: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`"${title}" başlıklı makaleyi silmek istediğinize emin misiniz?`)) return;

        try {
            await articleService.deleteArticle(id);
            alert("Makale başarıyla silindi.");
            await loadData();
        } catch (error: any) {
            console.error("Delete error:", error);
            alert(`Silme hatası: ${error.message}`);
        }
    };

    const handleToggleStatus = async (article: Article) => {
        if (!article.id) return;
        const newStatus = article.kategori === "Taslak" ? "Yayında" : "Taslak";
        try {
            await articleService.updateArticle(article.id, { kategori: newStatus });
            await loadData();
        } catch (error) {
            console.error("Status toggle error:", error);
        }
    };

    const handleScrapeSingle = async () => {
        if (!editFormData.kaynakURL) {
            alert("Kaynak URL bulunamadı.");
            return;
        }

        setIsSyncing(true);
        try {
            const scrapeUrl = `/api/scrape?url=${encodeURIComponent(editFormData.kaynakURL)}${sessionCookie ? `&cookie=${sessionCookie}` : ''}`;
            const res = await fetch(scrapeUrl);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setEditFormData({
                ...editFormData,
                baslik: data.baslik || editFormData.baslik,
                yazarAdi: data.yazarAdi || editFormData.yazarAdi,
                icerikHTML: data.icerikHTML || editFormData.icerikHTML,
                icerikText: data.spot || editFormData.icerikText
            });

            if (data.isTruncated) {
                alert("İçerik başarıyla getirildi ancak abone girişi yapılmadığı için metin kısıtlı (truncated) olabilir.");
            } else {
                alert("İçerik başarıyla web'den çekildi.");
            }
        } catch (error: any) {
            console.error("Scrape error:", error);
            alert(`İçerik çekme hatası: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleEditSave = async () => {
        if (!editingArticle?.id) return;
        try {
            await articleService.updateArticle(editingArticle.id, editFormData);
            setEditingArticle(null);
            await loadData();
            alert("Makale güncellendi.");
        } catch (error) {
            console.error("Update error:", error);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">İçerik Yönetimi</h1>
                    <p className="text-slate-500 font-medium">Sistem ayarlarını yapılandırın ve veritabanını yönetin.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-brand-purple/10 text-brand-purple rounded-full text-xs font-black uppercase tracking-widest border border-brand-purple/20">
                        Sistem Yöneticisi
                    </div>
                </div>
            </div>

            {/* Top Cards: Config & Sync */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Site Config Form */}
                <div className="lg:col-span-2 glass p-8 rounded-[32px] border border-white/50 space-y-8 shadow-xl shadow-slate-200/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center shadow-inner">
                                <Database className="text-slate-600 w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 leading-none">Aktif Kaynak Seçimi</h2>
                                <p className="text-sm text-slate-500 mt-1">İçerik çekilecek aktif abone sitesini seçin.</p>
                            </div>
                        </div>
                        <Link
                            href="/admin/subscriptions"
                            className="p-3 bg-slate-50 text-slate-500 hover:text-brand-purple rounded-xl transition-all border border-slate-100 hover:border-brand-purple/20 shadow-xs"
                            title="Abonelikleri Yönet"
                        >
                            <Settings className="w-5 h-5" />
                        </Link>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Abone Olunan Site</label>
                            <div className="relative group">
                                <Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-purple transition-colors" />
                                <select
                                    value={selectedSubId}
                                    onChange={(e) => setSelectedSubId(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl py-4 pl-11 pr-4 text-sm focus:ring-4 focus:ring-brand-purple/10 focus:border-brand-purple outline-hidden transition-all font-bold text-slate-900 appearance-none"
                                >
                                    <option value="">Abonelik seçiniz...</option>
                                    {subscriptions.map(sub => (
                                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.username})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Selected Site Details (Read-only) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giriş URL</p>
                                <p className="text-sm font-bold text-slate-600 truncate">{selectedSub?.url || "---"}</p>
                            </div>
                            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hesap Bilgisi</p>
                                <p className="text-sm font-bold text-slate-600">{selectedSub ? "AES-256 Şifreli Erişim" : "---"}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-brand-purple/5 rounded-2xl border border-brand-purple/10 text-brand-purple">
                        <ShieldCheck className="w-5 h-5 shrink-0" />
                        <p className="text-xs font-bold leading-relaxed">
                            Buradan seçeceğiniz site, botun bir sonraki çalışmasında temel alınacak kaynaktır.
                        </p>
                    </div>
                </div>

                {/* Sync Controls */}
                <div className="glass p-8 rounded-[32px] border border-white/50 flex flex-col justify-between shadow-xl shadow-slate-200/50 bg-linear-to-b from-white/80 to-slate-50/50">
                    <div className="space-y-6 text-center">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-brand-purple blur-2xl opacity-20 animate-pulse" />
                            <div className="relative w-20 h-20 bg-linear-to-br from-brand-purple to-brand-pink rounded-[24px] mx-auto flex items-center justify-center shadow-2xl shadow-brand-purple/30">
                                <RefreshCw className={cn("text-white w-10 h-10", isSyncing && "animate-spin")} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">İçerik Senkronizasyonu</h2>
                            <p className="text-sm text-slate-500 font-medium px-4">Seçilen dönemdeki tüm içerikleri arşive aktarın.</p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 px-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3" /> Yıl
                                </label>
                                <select
                                    value={syncYear}
                                    onChange={(e) => setSyncYear(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-purple/5"
                                >
                                    {[2026, 2025, 2024].filter(y => y <= new Date().getFullYear()).map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                                    <Hash className="w-3 h-3" /> Ay
                                </label>
                                <select
                                    value={syncMonth}
                                    onChange={(e) => setSyncMonth(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-purple/5"
                                >
                                    {["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"].map((m, idx) => {
                                        const isFuture = syncYear === new Date().getFullYear() && idx > new Date().getMonth();
                                        return (
                                            <option key={m} value={m} disabled={isFuture}>
                                                {m} {isFuture ? "(Henüz Oluşmadı)" : ""}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Bot Configuration */}
                        <div className="space-y-4 pt-2 border-t border-slate-100">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5 pt-2">
                                <Settings className="w-3 h-3" /> Bot Yapılandırması
                            </label>

                            <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl">
                                <span className="text-xs font-bold text-slate-700">Linkten Tam Metni Çek</span>
                                <button
                                    onClick={() => setForceScrape(!forceScrape)}
                                    className={cn(
                                        "w-10 h-5 rounded-full transition-colors relative",
                                        forceScrape ? "bg-brand-purple" : "bg-slate-200"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                        forceScrape ? "left-6" : "left-1"
                                    )} />
                                </button>
                            </div>

                            {forceScrape && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                    <label className="text-[10px] font-bold text-slate-500 pl-1">Session Cookie (PHPSESSID veya Tüm Cookie)</label>
                                    <input
                                        type="text"
                                        placeholder="Örn: abc123def456 veya PHPSESSID=abc123def456; path=/..."
                                        value={sessionCookie}
                                        onChange={(e) => setSessionCookie(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[10px] font-medium text-slate-700 outline-none focus:ring-4 focus:ring-brand-purple/5"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        {lastSyncResult && (
                            <div className={cn(
                                "p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300 border",
                                lastSyncResult.success ? "bg-green-50/50 border-green-100 text-green-700" : "bg-red-50/50 border-red-100 text-red-700"
                            )}>
                                {lastSyncResult.success ? <CheckCircle2 className="w-5 h-5 shadow-sm" /> : <AlertCircle className="w-5 h-5 shadow-sm" />}
                                <p className="text-xs font-bold leading-tight">
                                    {lastSyncResult.success
                                        ? `${lastSyncResult.count} yeni kayıt eklendi. ${lastSyncResult.skipped > 0 ? `(${lastSyncResult.skipped} mükerrer atlandı)` : ""}`
                                        : "HATA: Bağlantı kurulamadı."}
                                </p>
                            </div>
                        )}

                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={cn(
                                "w-full rounded-[20px] py-5 text-sm font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3",
                                isSyncing
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-linear-to-r from-brand-purple to-brand-pink text-white hover:shadow-brand-purple/40"
                            )}
                        >
                            {isSyncing ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    Çalışıyor...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-5 h-5" />
                                    Botu Başlat
                                </>
                            )}
                        </button>

                        {!isSyncing && (
                            <button
                                onClick={handleBulkDelete}
                                className="w-full rounded-[20px] py-3 text-[10px] font-black uppercase tracking-widest transition-all bg-white border border-red-100 text-red-500 hover:bg-red-50 active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Dönemi Temizle (Toplu Sil)
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Statistics Section */}
            <div className="glass p-8 rounded-[32px] border border-white/50 space-y-6 shadow-xl shadow-slate-200/50 bg-linear-to-br from-white/80 to-slate-50/30">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-inner border border-indigo-100/50">
                        <BarChart3 className="text-indigo-600 w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 leading-none tracking-tight">Veritabanı İstatistikleri</h2>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Yıl ve aylara göre kayıtlı makale sayıları özeti.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Object.entries(stats).length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-400 font-medium bg-slate-50/50 rounded-[28px] border-2 border-dashed border-slate-200 px-6">
                            <Database className="w-8 h-8 mx-auto mb-3 opacity-20" />
                            Henüz istatistik verisi bulunmuyor.
                        </div>
                    ) : (
                        Object.entries(stats).sort((a, b) => Number(b[0]) - Number(a[0])).map(([year, months]) => (
                            <div key={year} className="relative group p-6 bg-white/50 rounded-[28px] border border-slate-200/60 shadow-xs hover:border-brand-purple/20 transition-all duration-300">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-brand-purple shadow-xs shadow-brand-purple/40" />
                                        <h3 className="text-lg font-black text-slate-900 leading-none">{year}</h3>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black text-brand-purple bg-brand-purple/5 px-3 py-1.5 rounded-full border border-brand-purple/10 uppercase tracking-widest">
                                            {Object.values(months).reduce((a, b) => a + b.count, 0)} MAKALE
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 mt-1">
                                            {new Intl.NumberFormat('tr-TR').format(Object.values(months).reduce((a, b) => a + b.chars, 0))} Krkt.
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {Object.entries(months).sort((a, b) => {
                                        const monthsMap: Record<string, number> = { "Ocak": 1, "Şubat": 2, "Mart": 3, "Nisan": 4, "Mayıs": 5, "Haziran": 6, "Temmuz": 7, "Ağustos": 8, "Eylül": 9, "Ekim": 10, "Kasım": 11, "Aralık": 12 };
                                        return monthsMap[a[0]] - monthsMap[b[0]];
                                    }).map(([month, data]) => (
                                        <div key={month} className="flex items-center justify-between p-2 hover:bg-white rounded-xl transition-all group/item">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-500 group-hover/item:text-slate-900">{month}</span>
                                                <span className="text-[9px] text-slate-400 font-medium">
                                                    {new Intl.NumberFormat('tr-TR').format(data.chars)} Krkt.
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-1 w-8 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-brand-purple opacity-20" style={{ width: `${Math.min(100, (data.count / 35) * 100)}%` }} />
                                                </div>
                                                <span className="text-xs font-black text-slate-900">{data.count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Data Management Section */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-orange/10 rounded-xl flex items-center justify-center">
                            <Database className="text-brand-orange w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Veri Yönetimi</h2>
                            <p className="text-sm text-slate-500 font-medium">Firestore veritabanındaki tüm makaleleri listeleyin ve yönetin.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                            <select
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value === "Tümü" ? "Tümü" : Number(e.target.value))}
                                className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 outline-none cursor-pointer px-3 py-1.5"
                            >
                                <option value="Tümü">Yıl: Tümü</option>
                                {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <div className="w-px h-4 bg-slate-200" />
                            <select
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 outline-none cursor-pointer px-3 py-1.5"
                            >
                                <option value="Tümü">Ay: Tümü</option>
                                {["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-purple transition-colors" />
                            <input
                                type="text"
                                placeholder="Makale başlığı veya yazar ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-white border border-slate-200 rounded-2xl py-2.5 pl-10 pr-6 text-sm focus:ring-4 focus:ring-brand-purple/10 focus:border-brand-purple outline-hidden w-full md:w-64 shadow-sm transition-all font-medium"
                            />
                        </div>
                    </div>
                </div>

                {/* Table Container */}
                <div className="glass rounded-[32px] border border-white/50 overflow-hidden shadow-2xl shadow-slate-200/40">
                    <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-12">#</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <div className="flex items-center gap-2 cursor-pointer hover:text-slate-600 transition-colors">
                                            Makale Başlığı <ArrowUpDown className="w-3 h-3" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Yazar</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Sayı</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tarih</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Durum</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {articles.filter(a => {
                                    // Search term check
                                    const matchesSearch = a.baslik.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        a.yazarAdi.toLowerCase().includes(searchTerm.toLowerCase());

                                    // Year filter check
                                    const matchesYear = filterYear === "Tümü" || a.yil === filterYear;

                                    // Month filter check
                                    const matchesMonth = filterMonth === "Tümü" || a.ay === filterMonth;

                                    return matchesSearch && matchesYear && matchesMonth;
                                }).map((article, index) => (
                                    <tr key={article.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-4 py-5 text-center text-xs font-black text-slate-300 group-hover:text-brand-purple">
                                            {(index + 1).toString().padStart(2, '0')}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-brand-purple transition-colors">{article.baslik}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-brand-purple bg-brand-purple/5 px-1.5 py-0.5 rounded border border-brand-purple/10 uppercase tracking-tighter">
                                                        {(article.icerikHTML || article.icerikText || "").length} KRKT.
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {article.id?.substring(0, 8)}...</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    {article.yazarAdi[0]}
                                                </div>
                                                <span className="text-sm font-medium text-slate-700">{article.yazarAdi}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="text-sm font-bold text-slate-600">{article.dergiSayisi}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="text-xs font-medium text-slate-500">{article.yayinTarihi}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <button
                                                onClick={() => handleToggleStatus(article)}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                                                    article.kategori === "Taslak"
                                                        ? "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                                                        : "bg-green-50 text-green-600 border-green-100 hover:bg-green-100"
                                                )}
                                            >
                                                {article.kategori === "Taslak" ? "TASLAK" : "YAYINDA"}
                                            </button>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingArticle(article);
                                                        setEditFormData(article);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                                    title="Düzenle"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => alert(`Önizleme: ${article.baslik}\n\nYazar: ${article.yazarAdi}\n\nİçerik özeti: ${article.icerikText.substring(0, 100)}...`)}
                                                    className="p-2 text-slate-400 hover:text-brand-purple hover:bg-brand-purple/5 rounded-xl transition-all"
                                                    title="Önizle"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => window.open(article.kaynakURL, '_blank')}
                                                    className="p-2 text-slate-400 hover:text-brand-purple hover:bg-brand-purple/5 rounded-xl transition-all"
                                                    title="Kaynağa Git"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                                <div className="w-px h-4 bg-slate-100 mx-1" />
                                                <button
                                                    onClick={() => article.id && handleDelete(article.id, article.baslik)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Sil"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {/* Edit Modal */}
            {editingArticle && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Makaleyi Düzenle</h2>
                                <p className="text-sm text-slate-500">İçerik bilgilerini güncelleyin.</p>
                            </div>
                            <button onClick={() => setEditingArticle(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Başlık</label>
                                    <input
                                        type="text"
                                        value={editFormData.baslik}
                                        onChange={(e) => setEditFormData({ ...editFormData, baslik: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-purple/10 outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Yazar</label>
                                    <input
                                        type="text"
                                        value={editFormData.yazarAdi}
                                        onChange={(e) => setEditFormData({ ...editFormData, yazarAdi: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-purple/10 outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sayı</label>
                                    <input
                                        type="text"
                                        value={editFormData.dergiSayisi}
                                        onChange={(e) => setEditFormData({ ...editFormData, dergiSayisi: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-purple/10 outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Yayın Tarihi</label>
                                    <input
                                        type="text"
                                        value={editFormData.yayinTarihi}
                                        onChange={(e) => setEditFormData({ ...editFormData, yayinTarihi: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-purple/10 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Spot / Kısa Metin</label>
                                <textarea
                                    value={editFormData.icerikText}
                                    onChange={(e) => setEditFormData({ ...editFormData, icerikText: e.target.value })}
                                    rows={3}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-xs font-medium text-slate-700 focus:ring-4 focus:ring-brand-purple/10 outline-none resize-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tam Metin (HTML)</label>
                                <textarea
                                    value={editFormData.icerikHTML}
                                    onChange={(e) => setEditFormData({ ...editFormData, icerikHTML: e.target.value })}
                                    rows={10}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-xs font-mono text-slate-700 focus:ring-4 focus:ring-brand-purple/10 outline-none"
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={handleScrapeSingle}
                                    disabled={isSyncing}
                                    className="flex-1 bg-slate-100 text-slate-600 rounded-2xl py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Globe2 className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                                    Web'den Güncelle
                                </button>
                                <button
                                    onClick={handleEditSave}
                                    disabled={isSyncing}
                                    className="flex-2 bg-linear-to-r from-brand-purple to-brand-pink text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs hover:shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Değişiklikleri Kaydet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
