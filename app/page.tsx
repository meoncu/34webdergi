"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  BookOpen,
  User,
  ArrowRight,
  Calendar,
  ChevronRight,
  Filter,
  Library,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { articleService } from "@/lib/articles";
import { Article } from "@/types";

export default function Dashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableStats, setAvailableStats] = useState<Record<number, Record<string, { count: number; chars: number; words: number }>>>({});

  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<string>("Ocak");

  // İlk yüklemede hafızadan getir
  useEffect(() => {
    const savedYear = sessionStorage.getItem("selectedYear");
    const savedMonth = sessionStorage.getItem("selectedMonth");
    if (savedYear) setSelectedYear(Number(savedYear));
    if (savedMonth) setSelectedMonth(savedMonth);
  }, []);

  // Seçim değiştikçe hafızaya kaydet
  useEffect(() => {
    sessionStorage.setItem("selectedYear", selectedYear.toString());
    sessionStorage.setItem("selectedMonth", selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Mevcut yıl/ay listesini getir
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await articleService.getStats();
        setAvailableStats(stats);

        // Sadece hafızada kayıt yoksa en güncel yılı seç
        const savedYear = sessionStorage.getItem("selectedYear");
        if (!savedYear) {
          const years = Object.keys(stats).map(Number).sort((a, b) => b - a);
          if (years.length > 0) {
            const latestYear = years[0];
            setSelectedYear(latestYear);
            const months = Object.keys(stats[latestYear]);
            if (months.length > 0) {
              setSelectedMonth(months[0]);
            }
          }
        }
      } catch (error) {
        console.error("Stats fetch error:", error);
      }
    };
    fetchStats();
  }, []);

  // Seçilen döneme göre makaleleri getir
  useEffect(() => {
    const fetchArticles = async () => {
      console.log("Fetching articles for:", selectedYear, selectedMonth);
      setIsLoading(true);
      try {
        const data = await articleService.getByPeriod(selectedYear, selectedMonth);
        console.log("Articles fetched:", data.length);
        setArticles(data);
      } catch (error) {
        console.error("Fetch articles error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticles();
  }, [selectedYear, selectedMonth]);

  const years = Object.keys(availableStats).map(Number).sort((a, b) => b - a);
  const months = availableStats[selectedYear] ? Object.keys(availableStats[selectedYear]) : [];

  // Yıl değiştiğinde seçili ayın geçerliliğini kontrol et
  useEffect(() => {
    // Sadece hafızada olmayan veya geçersiz olan ay durumunda düzeltme yap
    if (months.length > 0 && !months.includes(selectedMonth)) {
      setSelectedMonth(months[0]);
    }
  }, [selectedYear, months, selectedMonth]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Semi-Transparent Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-purple shadow-sm shadow-brand-purple/50" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Arşiv Sistemi</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dijital Kitaplık</h1>
          <p className="text-sm text-slate-500 font-medium">İstediğiniz sayıdaki makalelere hızlıca ulaşın.</p>
        </div>

        {/* Minimalist Filter Bar */}
        <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200/40 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-brand-purple" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer hover:text-brand-purple transition-colors"
            >
              {years.length > 0 ? years.map(y => (
                <option key={y} value={y}>{y}</option>
              )) : <option value={2026}>2026</option>}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200/40 shadow-xs">
            <Filter className="w-3.5 h-3.5 text-brand-orange" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer hover:text-brand-orange transition-colors"
            >
              {months.length > 0 ? months.map(m => (
                <option key={m} value={m}>{m}</option>
              )) : <option value="Ocak">Ocak</option>}
            </select>
          </div>

          <div className="px-4 py-2 text-[10px] font-black text-white bg-slate-900 rounded-xl uppercase tracking-widest hidden sm:block shadow-lg shadow-slate-900/10">
            {articles.length} MAKALE
          </div>
        </div>
      </div>

      {/* Grid Area */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-brand-purple" />
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {selectedMonth} {selectedYear}
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="h-48 bg-slate-50 rounded-2xl animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="bg-slate-50/50 rounded-3xl border border-slate-200 border-dashed py-24 text-center">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">İçerik Bulunamadı</h3>
            <p className="text-sm font-medium text-slate-500">Bu döneme ait makale kaydı mevcut değil.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/article/${article.id}`}
                className="group relative bg-white rounded-xl border border-slate-200 hover:border-brand-purple/40 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/40 flex flex-col h-full active:scale-[0.98] overflow-hidden"
              >
                {/* Decorative top bar */}
                <div className="h-1 w-0 group-hover:w-full bg-brand-purple transition-all duration-500" />

                <div className="p-5 flex flex-col flex-1 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-1 bg-brand-purple/5 text-brand-purple rounded-md text-[9px] font-black uppercase tracking-widest border border-brand-purple/10">
                      {article.kategori || "Genel"}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-brand-purple transition-colors">
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
                    </div>
                  </div>

                  <h3 className="text-[15px] font-black text-slate-800 leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-brand-purple transition-colors">
                    {article.baslik}
                  </h3>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200/50 group-hover:border-brand-purple/20 transition-colors">
                        <User className="w-4 h-4 text-slate-400 group-hover:text-brand-purple transition-colors" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 truncate max-w-[100px]">{article.yazarAdi}</span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-brand-orange uppercase leading-none">{article.ay}</span>
                      <span className="text-[9px] font-bold text-slate-400 tracking-tighter">{article.yil}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Minimal Footer */}
      <div className="pt-12 text-center opacity-30">
        <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.5em]">Altınoluk Dijital Arşiv v1.0</span>
      </div>
    </div>
  );
}
