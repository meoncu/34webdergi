"use client";

import { useState } from "react";
import {
    Globe2,
    User,
    Lock,
    Plus,
    Trash2,
    Edit2,
    ShieldCheck,
    LayoutGrid,
    Search,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

import { subscriptionService } from "@/lib/subscriptions";
import { SubscriptionSite } from "@/types";
import { useEffect } from "react";

export default function SubscriptionManagement() {
    const [subscriptions, setSubscriptions] = useState<SubscriptionSite[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [editingSub, setEditingSub] = useState<SubscriptionSite | null>(null);
    const [formData, setFormData] = useState({ name: "", url: "", username: "", password: "" });

    useEffect(() => {
        loadSubscriptions();
    }, []);

    const loadSubscriptions = async () => {
        console.log("Loading subscriptions...");
        setIsLoading(true);

        // Add a timeout to prevent infinite spinning if Firestore hangs
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Bağlantı zaman aşımına uğradı (10s)")), 10000)
        );

        try {
            const data = await Promise.race([
                subscriptionService.getAll(),
                timeoutPromise
            ]) as SubscriptionSite[];

            console.log("Subscriptions loaded successfully:", data.length);
            setSubscriptions(data);
        } catch (error: any) {
            console.error("Error loading subscriptions:", error);
            // If it's a timeout, show a more user-friendly alert
            if (error.message?.includes("zaman aşımı")) {
                alert("Veritabanına bağlanılamadı. Lütfen internet bağlantınızı veya Firebase ayarlarınızı kontrol edin.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (sub: SubscriptionSite) => {
        setEditingSub(sub);
        setFormData({
            name: sub.name,
            url: sub.url,
            username: sub.username,
            password: ""
        });
        setIsAdding(true);
    };

    const handleSave = async () => {
        console.log("HandleSave triggered with data:", formData);

        if (!formData.name || !formData.url || !formData.username) {
            alert("Lütfen tüm alanları (İsim, URL, Kullanıcı Adı) doldurun.");
            return;
        }

        setIsSaving(true);
        try {
            if (editingSub?.id) {
                console.log("Updating existing sub:", editingSub.id);
                await subscriptionService.update(editingSub.id, {
                    name: formData.name,
                    url: formData.url,
                    username: formData.username,
                    ...(formData.password ? { passwordEncrypted: formData.password } : {})
                });
            } else {
                console.log("Adding new sub...");
                await subscriptionService.add({
                    name: formData.name,
                    url: formData.url,
                    username: formData.username,
                    passwordEncrypted: formData.password
                });
            }

            console.log("Save successful!");
            await loadSubscriptions();
            setIsAdding(false);
            setEditingSub(null);
            setFormData({ name: "", url: "", username: "", password: "" });
            alert("Sistem kaydı başarıyla tamamlandı.");
        } catch (error: any) {
            console.error("Save error details:", error);
            alert(`Kaydedilirken hata oluştu: ${error.message || "Bilinmeyen hata"}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!id) return;
        if (confirm("Bu aboneliği silmek istediğinize emin misiniz?")) {
            try {
                await subscriptionService.delete(id);
                await loadSubscriptions();
            } catch (error) {
                console.error("Error deleting:", error);
                alert("Silinirken bir hata oluştu.");
            }
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kaynak Site Yönetimi</h1>
                    <p className="text-slate-500 font-medium text-lg">Abone olduğunuz dergi sitelerini ve giriş bilgilerini yönetin.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl active:scale-95 group"
                >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    Yeni Site Ekle
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Info Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass p-8 rounded-[32px] border border-white/50 space-y-6 shadow-xl shadow-slate-200/50 bg-linear-to-br from-brand-purple/5 to-transparent">
                        <div className="w-12 h-12 bg-brand-purple/10 rounded-2xl flex items-center justify-center">
                            <ShieldCheck className="text-brand-purple w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 leading-tight">Güvenli Veri Saklama</h2>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            Eklediğiniz tüm kullanıcı adları ve şifreler, Firebase veritabanında **AES-256** standardında şifrelenerek saklanır. Senkronizasyon sırasında sadece sunucu tarafında geçici olarak çözülür.
                        </p>
                    </div>

                    <div className="glass p-8 rounded-[32px] border border-white/50 space-y-4 shadow-xl shadow-slate-200/50">
                        <div className="flex items-center gap-2 text-slate-900 font-bold">
                            <LayoutGrid className="w-5 h-5 text-brand-orange" />
                            İstatistikler
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kayıtlı Site</p>
                                <p className="text-2xl font-black text-slate-900 mt-1">{subscriptions.length}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aktif Bot</p>
                                <p className="text-2xl font-black text-slate-900 mt-1">2</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main List Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Add/Edit Form Overlay */}
                    {isAdding && (
                        <div className="glass p-8 rounded-[32px] border-2 border-brand-purple/20 space-y-6 shadow-2xl relative animate-in slide-in-from-top-4">
                            <h2 className="text-xl font-bold text-slate-900">
                                {editingSub ? `${editingSub.name} - Düzenle` : "Yeni Abonelik Bilgisi"}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Site Adı (Etiket)</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Örn: Altınoluk"
                                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm focus:ring-4 focus:ring-brand-purple/10 focus:border-brand-purple transition-all font-bold text-slate-700"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Giriş URL'si</label>
                                    <input
                                        type="text"
                                        value={formData.url}
                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                        placeholder="https://..."
                                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm focus:ring-4 focus:ring-brand-purple/10 focus:border-brand-purple transition-all font-bold text-slate-700"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kullanıcı Adı</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm focus:ring-4 focus:ring-brand-purple/10 focus:border-brand-purple transition-all font-bold text-slate-700"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Şifre</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        title="Şifre"
                                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm focus:ring-4 focus:ring-brand-purple/10 focus:border-brand-purple transition-all font-bold text-slate-700"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex-1 bg-brand-purple text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-brand-purple/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Kaydediliyor...
                                        </>
                                    ) : (
                                        editingSub ? "Değişiklikleri Kaydet" : "Sisteme Kaydet"
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsAdding(false);
                                        setEditingSub(null);
                                    }}
                                    className="px-8 bg-slate-100 text-slate-600 rounded-2xl py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                                >
                                    Vazgeç
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Subscription Cards List */}
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Siteleriniz arasında arayın..."
                                className="w-full bg-white border border-slate-200 rounded-[20px] py-4 pl-12 pr-6 text-sm shadow-sm focus:ring-4 focus:ring-brand-purple/5 transition-all outline-hidden font-medium"
                            />
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <RefreshCw className="w-10 h-10 text-slate-200 animate-spin" />
                            </div>
                        ) : subscriptions.length === 0 ? (
                            <div className="text-center py-20 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                                <Globe2 className="w-12 h-12 text-slate-200 mx-auto" />
                                <p className="text-slate-400 font-medium mt-4">Henüz kayıtlı bir site bulunmuyor.</p>
                            </div>
                        ) : (
                            subscriptions.map((sub) => (
                                <div key={sub.id} className="group glass p-6 rounded-[28px] border border-white/50 hover:border-brand-purple/20 transition-all duration-300 shadow-lg shadow-slate-200/20 flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                                            <Globe2 className="w-6 h-6 text-brand-purple" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg leading-tight">{sub.name}</h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                                    <User className="w-3 h-3" /> {sub.username}
                                                </span>
                                                <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                                    <Globe2 className="w-3 h-3" /> {sub.url ? new URL(sub.url).hostname : "Geçersiz URL"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(sub)}
                                            className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-brand-purple hover:border-brand-purple/20 transition-all"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => sub.id && handleDelete(sub.id)}
                                            className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-red-500 hover:border-red-100 transition-all"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )))}
                    </div>
                </div>
            </div>
        </div>
    );
}
