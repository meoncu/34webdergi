"use client";

import { useState, useEffect } from "react";
import {
    ArrowLeft,
    Share2,
    Moon,
    Sun,
    Type,
    BookMarked,
    Clock,
    User,
    Printer,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    Volume2,
    VolumeX,
    Play,
    Pause,
    Square
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { articleService } from "@/lib/articles";
import { analyticsService } from "@/lib/analytics";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Article, Comment } from "@/types";
import { Heart, MessageCircle, Send } from "lucide-react";

export default function ArticleDetail() {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [fontSize, setFontSize] = useState(18);
    const [article, setArticle] = useState<Article | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Analytics & Social States
    const [readCount, setReadCount] = useState(0);
    const [likeCount, setLikeCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [prevArticle, setPrevArticle] = useState<Article | null>(null);
    const [nextArticle, setNextArticle] = useState<Article | null>(null);

    // TTS States
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);
    const [isManualStop, setIsManualStop] = useState(false);

    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = params?.id as string;
    const isAutoplay = searchParams?.get('autoplay') === 'true';

    // Auth monitor
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Article Data & Log Read
    useEffect(() => {
        const fetchArticle = async () => {
            if (!id) return;
            // Stop speech when changing articles
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
                setIsPaused(false);
            }
            try {
                const data = await articleService.getById(id);
                if (data) {
                    setArticle(data);

                    // Stats
                    const [rc, lc, comms] = await Promise.all([
                        analyticsService.getArticleReadCount(id),
                        analyticsService.getLikeCount(id),
                        analyticsService.getComments(id)
                    ]);
                    setReadCount(rc);
                    setLikeCount(lc);
                    setComments(comms);

                    // Fetch next/prev articles
                    const periodArticles = await articleService.getByPeriod(data.yil, data.ay);
                    const currentIndex = periodArticles.findIndex(a => a.id === id);
                    if (currentIndex !== -1) {
                        setPrevArticle(currentIndex > 0 ? periodArticles[currentIndex - 1] : null);
                        setNextArticle(currentIndex < periodArticles.length - 1 ? periodArticles[currentIndex + 1] : null);
                    }

                    // User specific
                    if (currentUser) {
                        const [liked, bookmarked] = await Promise.all([
                            analyticsService.isLiked(id, currentUser.uid),
                            analyticsService.isBookmarked(id, currentUser.uid)
                        ]);
                        setIsLiked(liked);
                        setIsBookmarked(bookmarked);

                        // Log Read Event
                        await analyticsService.logActivity({
                            type: 'read',
                            userId: currentUser.uid,
                            userName: currentUser.displayName || 'Anonim',
                            userEmail: currentUser.email || '',
                            articleId: id,
                            articleTitle: data.baslik
                        });
                    }

                    // Store next article ID in a ref-like way for the TTS end handler
                    // (But we already have nextArticle state)
                }
            } catch (error) {
                console.error("Fetch article error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        if (id) fetchArticle();
    }, [id, currentUser]);

    // Handle Auto-play on mount
    useEffect(() => {
        if (!isLoading && article && isAutoplay) {
            const timer = setTimeout(() => {
                // Check if voices are ready
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    handleSpeech();
                } else {
                    // Try again in a bit if voices are still loading
                    const retryTimer = setTimeout(handleSpeech, 500);
                    return () => clearTimeout(retryTimer);
                }
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [isLoading, id, isAutoplay]); // Trigger when ID changes or loading finishes

    const handleRefresh = async () => {
        if (!id || !article?.kaynakURL || isRefreshing) return;
        
        setIsRefreshing(true);
        try {
            const response = await fetch('/api/article/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, url: article.kaynakURL })
            });
            const result = await response.json();
            
            if (result.success) {
                alert("Makale başarıyla güncellendi! Sayfa yenileniyor.");
                router.refresh(); // Or reload window
                window.location.reload();
            } else {
                alert("Güncelleme hatası: " + (result.error || "Bilinmeyen hata"));
            }
        } catch (error: any) {
            alert("Sistem hatası: " + error.message);
        } finally {
            setIsRefreshing(false);
        }
    };

    // --- Speech Synthesis Logic ---
    useEffect(() => {
        return () => {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

    const handleSpeech = () => {
        setIsManualStop(false);
        if (!article) return;

        // If currently speaking, handle pause/resume
        if (isSpeaking && !isPaused) {
            window.speechSynthesis.pause();
            setIsPaused(true);
            return;
        }

        if (isSpeaking && isPaused) {
            window.speechSynthesis.resume();
            setIsPaused(false);
            return;
        }

        // --- Start a fresh speech session ---
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const fullText = `${article.baslik}. Yazar: ${article.yazarAdi}. ${stripHtml(article.icerikHTML || article.icerikText)}`;
        
        // Split text into manageable chunks (approx 200-300 chars, preferably at boundaries)
        // This prevents the common browser issue where long text stops playing or throws errors.
        const chunks = fullText.match(/.{1,250}(\s|$)|.{1,250}/g) || [fullText];
        let currentChunkIndex = 0;

        const speakChunk = (index: number) => {
            if (index >= chunks.length) {
                setIsSpeaking(false);
                setIsPaused(false);
                
                // End of entire article reached - check for auto-advance
                if (!isManualStop && nextArticle) {
                    router.push(`/article/${nextArticle.id}?autoplay=true`);
                }
                return;
            }

            const chunk = chunks[index].trim();
            if (!chunk) {
                speakChunk(index + 1);
                return;
            }

            const newUtterance = new SpeechSynthesisUtterance(chunk);
            
            // Find Turkish voice
            const voices = window.speechSynthesis.getVoices();
            const trVoice = voices.find(v => v.lang.startsWith('tr') || v.lang.startsWith('TR'));
            if (trVoice) newUtterance.voice = trVoice;
            
            newUtterance.lang = 'tr-TR';
            newUtterance.rate = playbackRate;
            newUtterance.pitch = 1.0;

            newUtterance.onstart = () => {
                setIsSpeaking(true);
                setIsPaused(false);
                currentChunkIndex = index;
            };

            newUtterance.onend = () => {
                // If not manually stopped, proceed to next chunk
                if (!isManualStop) {
                    speakChunk(index + 1);
                }
            };

            newUtterance.onerror = (event: any) => {
                // 'interrupted' is normal when calling cancel() or change rate
                if (event.error === 'interrupted' || event.error === 'canceled' || isManualStop) {
                    return;
                }
                
                console.error("Speech error detail:", event.error, event);
                setIsSpeaking(false);
                setIsPaused(false);
            };

            window.speechSynthesis.speak(newUtterance);
        };

        // Start the first chunk
        speakChunk(0);
    };

    const stopSpeech = () => {
        setIsManualStop(true);
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
    };
    // ----------------------------

    const handleLike = async () => {
        if (!currentUser || !article || !id) return;
        const result = await analyticsService.toggleLike(
            id,
            currentUser.uid,
            currentUser.displayName || 'Anonim',
            currentUser.email || '',
            article.baslik
        );
        setIsLiked(result);
        setLikeCount(prev => result ? prev + 1 : prev - 1);
    };

    const handleShare = async () => {
        if (!article) return;
        const shareData = {
            title: article.baslik,
            text: `${article.baslik} - ${article.yazarAdi}`,
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Share error:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                alert("Bağlantı kopyalandı!");
            } catch (err) {
                console.error('Clipboard error:', err);
            }
        }
    };

    const handleBookmark = async () => {
        if (!currentUser || !id) {
            alert("Kaydetmek için giriş yapmalısınız.");
            return;
        }
        const result = await analyticsService.toggleBookmark(id, currentUser.uid);
        setIsBookmarked(result);
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !article || !newComment.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const commentObj = {
                articleId: id as string,
                userId: currentUser.uid,
                userName: currentUser.displayName || 'Anonim',
                userPhoto: currentUser.photoURL || '',
                text: newComment.trim()
            };
            await analyticsService.addComment(commentObj, currentUser.email || '', article.baslik);
            setNewComment("");
            const updatedComments = await analyticsService.getComments(id as string);
            setComments(updatedComments);
        } catch (error: any) {
            console.error("Comment error:", error);
            alert("Yorum gönderilemedi: " + (error.message || "Bilinmeyen bir hata oluştu."));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-brand-purple animate-spin mx-auto" />
                    <p className="text-slate-500 font-bold animate-pulse">İçerik yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center space-y-6 p-8 max-w-md">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ArrowLeft className="w-10 h-10" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">Makale Bulunamadı</h1>
                    <p className="text-slate-500 font-medium">Aradığınız yazı veritabanında mevcut değil veya silinmiş olabilir.</p>
                    <Link href="/" className="inline-block bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all">
                        Ana Sayfaya Dön
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "min-h-screen transition-colors duration-500",
            isDarkMode ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-900"
        )}>
            {/* Article Header (Pinned/Scroll) */}
            <div className={cn(
                "sticky top-0 z-30 border-b backdrop-blur-md transition-colors",
                isDarkMode ? "bg-slate-950/80 border-slate-800" : "bg-white/80 border-slate-200"
            )}>
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-purple transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Geri Dön</span>
                        </Link>
                        
                        <div className="hidden md:flex items-center gap-1">
                            {prevArticle && (
                                <Link 
                                    href={`/article/${prevArticle.id}`} 
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-brand-purple transition-colors"
                                    title={`Önceki: ${prevArticle.baslik}`}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </Link>
                            )}
                            {nextArticle && (
                                <Link 
                                    href={`/article/${nextArticle.id}`} 
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-brand-purple transition-colors"
                                    title={`Sonraki: ${nextArticle.baslik}`}
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleSpeech}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border",
                                    isSpeaking 
                                        ? "bg-brand-purple text-white border-brand-purple shadow-lg shadow-brand-purple/20" 
                                        : "bg-white dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-800 hover:text-brand-purple hover:border-brand-purple"
                                )}
                                title={isSpeaking ? (isPaused ? "Devam Et" : "Duraklat") : "Sesli Dinle"}
                            >
                                {isPaused || !isSpeaking ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">
                                    {isSpeaking ? (isPaused ? "Duraklatıldı" : "Dinleniyor") : "Dinle"}
                                </span>
                            </button>

                            {isSpeaking && (
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-1.5 py-1 ml-1">
                                    {[1, 1.25, 1.5, 2].map(rate => (
                                        <button 
                                            key={rate}
                                            onClick={() => {
                                                setPlaybackRate(rate);
                                                // Restart to apply rate immediately (simplest way)
                                                window.speechSynthesis.cancel();
                                                setTimeout(handleSpeech, 100);
                                            }}
                                            className={cn(
                                                "text-[9px] font-black px-1.5 py-0.5 rounded-md transition-all",
                                                playbackRate === rate 
                                                    ? "bg-white dark:bg-slate-700 text-brand-purple shadow-sm scale-110" 
                                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                            )}
                                        >
                                            {rate}x
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {isSpeaking && (
                            <button
                                onClick={stopSpeech}
                                className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-red-500 transition-colors"
                                title="Durdur"
                            >
                                <Square className="w-4 h-4 fill-current" />
                            </button>
                        )}

                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
                        
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className={cn(
                                "p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-brand-purple",
                                isRefreshing && "opacity-50 cursor-not-allowed"
                            )}
                            title="Kaynaktan Güncelle"
                        >
                            <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
                        </button>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
                        <button
                            onClick={() => setFontSize(prev => Math.min(prev + 2, 24))}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Yazı Tipini Büyüt"
                        >
                            <Type className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
                        <button
                            onClick={handleShare}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-brand-purple"
                        >
                            <Share2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleBookmark}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                isBookmarked
                                    ? "bg-brand-purple/10 text-brand-purple"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-brand-purple"
                            )}
                        >
                            <BookMarked className={cn("w-5 h-5", isBookmarked && "fill-current")} />
                        </button>
                    </div>
                </div>
            </div>

            <article className="max-w-3xl mx-auto px-6 py-12 space-y-12">
                {/* Meta */}
                <div className="space-y-6 text-center">
                    <div className="flex items-center justify-center gap-4">
                        <span className="px-3 py-1 bg-brand-purple/10 text-brand-purple rounded-full text-xs font-bold uppercase tracking-widest">
                            Sayı {article.dergiSayisi}
                        </span>
                        <span className="text-sm font-medium text-slate-400">
                            {article.hicriYil || article.ay + " " + article.yil}
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
                        {article.baslik}
                    </h1>

                    <div className="flex flex-col items-center gap-4 pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-linear-to-br from-brand-purple to-brand-pink p-0.5">
                                <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                                    <User className="w-6 h-6 text-slate-400" />
                                </div>
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-lg">{article.yazarAdi}</p>
                                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                    <span>{article.yayinTarihi}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span>{new Intl.NumberFormat('tr-TR').format((article.icerikHTML || article.icerikText || "").length)} Karakter</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span>{(article.icerikHTML || article.icerikText || "").split(/\s+/).filter(Boolean).length} Kelime</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div
                    className={cn(
                        "prose prose-slate lg:prose-xl mx-auto overflow-visible transition-all duration-300",
                        isDarkMode && "prose-invert",
                    )}
                    style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: article.icerikHTML || article.icerikText }}
                />

                <div className="h-px bg-linear-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent my-16" />

                {/* Social Actions */}
                <div className="flex items-center justify-center gap-8 py-8 border-y border-slate-100 dark:border-slate-800">
                    <button
                        onClick={handleLike}
                        className={cn(
                            "flex flex-col items-center gap-2 transition-all active:scale-90",
                            isLiked ? "text-red-500" : "text-slate-400 hover:text-red-500"
                        )}
                    >
                        <div className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center border transition-all",
                            isLiked ? "bg-red-50 border-red-200" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        )}>
                            <Heart className={cn("w-6 h-6", isLiked && "fill-current")} />
                        </div>
                        <span className="text-sm font-bold">{likeCount} Beğeni</span>
                    </button>

                    <div className="flex flex-col items-center gap-2 text-slate-400">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                            <Clock className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-bold">{readCount} Okunma</span>
                    </div>

                    <div className="flex flex-col items-center gap-2 text-slate-400">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                            <MessageCircle className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-bold">{comments.length} Yorum</span>
                    </div>
                </div>

                {/* Comment Section */}
                <div className="space-y-8 pt-12">
                    <h3 className="text-2xl font-black flex items-center gap-3">
                        <MessageCircle className="w-6 h-6 text-brand-purple" />
                        Yorumlar ({comments.length})
                    </h3>

                    {currentUser ? (
                        <form onSubmit={handleComment} className="relative group">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Düşüncelerinizi paylaşın..."
                                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-6 pr-16 min-h-[120px] focus:border-brand-purple outline-none transition-all placeholder:text-slate-400"
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting || !newComment.trim()}
                                className="absolute bottom-6 right-6 w-10 h-10 bg-brand-purple text-white rounded-full flex items-center justify-center hover:bg-brand-purple/90 transition-all disabled:opacity-50 disabled:scale-95 shadow-lg shadow-brand-purple/20"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                        </form>
                    ) : (
                        <div className="bg-slate-100/50 dark:bg-slate-900/50 p-8 rounded-3xl text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-slate-500 font-bold mb-4 text-lg">Yorum yapmak için giriş yapmalısınız.</p>
                            <Link href="/login" className="inline-flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all">
                                Giriş Yap
                            </Link>
                        </div>
                    )}

                    <div className="space-y-6">
                        {comments.length === 0 ? (
                            <p className="text-center text-slate-400 italic py-8">Henüz yorum yapılmamış. İlk yorumu siz yapın!</p>
                        ) : comments.map((comment) => (
                            <div key={comment.id} className="flex gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                    {comment.userPhoto ? (
                                        <img src={comment.userPhoto} alt={comment.userName} className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>
                                <div className="flex-1 space-y-2 text-left">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-slate-900 dark:text-slate-200">{comment.userName}</p>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {comment.createdAt?.toDate?.() ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(comment.createdAt.toDate()) : 'Az önce'}
                                        </span>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{comment.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="h-px bg-linear-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent my-16" />

                {/* Footer Navigation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-20">
                    {prevArticle ? (
                        <Link href={`/article/${prevArticle.id}`} className="group p-6 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-brand-purple transition-all text-left">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                <ChevronLeft className="w-4 h-4 text-brand-purple" /> Önceki Yazı
                            </div>
                            <p className="font-bold group-hover:text-brand-purple transition-colors line-clamp-2 leading-snug">{prevArticle.baslik}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">{prevArticle.yazarAdi}</p>
                        </Link>
                    ) : (
                        <Link href="/" className="group p-6 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-brand-purple transition-all text-left">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                <ChevronLeft className="w-4 h-4 text-brand-purple" /> Arşive Dön
                            </div>
                            <p className="font-bold group-hover:text-brand-purple transition-colors">Tüm yazılara göz atın</p>
                        </Link>
                    )}

                    {nextArticle ? (
                        <Link 
                            id="next-article-id"
                            data-id={nextArticle.id}
                            href={`/article/${nextArticle.id}${isAutoplay ? '?autoplay=true' : ''}`} 
                            className="group p-6 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-brand-purple transition-all text-right"
                        >
                            <div className="flex items-center justify-end gap-2 text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                Sonraki Yazı <ChevronRight className="w-4 h-4 text-brand-purple" />
                            </div>
                            <p className="font-bold group-hover:text-brand-purple transition-colors line-clamp-2 leading-snug">{nextArticle.baslik}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">{nextArticle.yazarAdi}</p>
                        </Link>
                    ) : (
                        <button
                            onClick={() => window.open(article.kaynakURL, '_blank')}
                            className="group p-6 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-brand-purple transition-all text-right"
                        >
                            <div className="flex items-center justify-end gap-2 text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                Kaynağa Git <ChevronRight className="w-4 h-4 text-brand-purple" />
                            </div>
                            <p className="font-bold group-hover:text-brand-purple transition-colors">Orijinal metni görüntüle</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">altinoluk.com.tr</p>
                        </button>
                    )}
                </div>
            </article>

            {/* Floating Action Menu for Mobile */}
            <div className="fixed bottom-8 right-8 flex flex-col gap-3 group">
                {isSpeaking && (
                    <>
                        <button 
                            onClick={stopSpeech}
                            className="w-12 h-12 bg-red-500 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-red-600 transition-all scale-90"
                        >
                            <Square className="w-5 h-5 fill-current" />
                        </button>
                        <button 
                            onClick={handleSpeech}
                            className="w-14 h-14 bg-brand-purple text-white rounded-full shadow-2xl flex items-center justify-center animate-bounce-subtle"
                        >
                            {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                        </button>
                    </>
                )}
                {!isSpeaking && (
                    <button 
                        onClick={handleSpeech}
                        className="w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-brand-purple transition-colors"
                    >
                        <Volume2 className="w-6 h-6" />
                    </button>
                )}
                <button className="w-12 h-12 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full shadow-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 sm:hidden">
                    <Printer className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
