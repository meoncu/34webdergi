import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getAuthCookie } from '@/lib/scraper-auth';

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    const mode = req.nextUrl.searchParams.get('mode'); // 'article', 'issue', or 'discover'
    let cookieString = req.nextUrl.searchParams.get('cookie');

    // Eğer dışarıdan cookie verilmediyse otomatik giriş mekanizmasını kullan
    if (!cookieString) {
        const autoCookie = await getAuthCookie();
        if (autoCookie) {
            cookieString = autoCookie;
        }
    }

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
        const headers: any = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        };

        if (cookieString) {
            headers['Cookie'] = cookieString.includes('=') ? cookieString : `PHPSESSID=${cookieString}`;
        }

        const response = await axios.get(url, { headers, timeout: 15000 });
        const $ = cheerio.load(response.data);

        // ====================================================================
        // MODE: DISCOVER - Arşiv sayfasından (/dergi-arsivi) sayıları bul
        // ve belirli yıl/ay eşleşmesini döndür
        // ====================================================================
        if (mode === 'discover') {
            const targetMonth = req.nextUrl.searchParams.get('month'); // Örn: "Şubat"
            const targetYear = req.nextUrl.searchParams.get('year');   // Örn: "2026"

            // Sayfadaki tüm text'leri tara, "Şubat 2026" gibi bir eşleşme ara
            const bodyText = response.data;
            
            // Yeni site yapısında her sayı bir kart olarak listeleniyor.
            // Her kartta "Şubat 2026", "480. Sayı", "30 Yazı" ve bir link var.
            // Ana linki bulmak için tüm <a> etiketlerini tara
            const allLinks: { text: string; href: string }[] = [];
            $('a').each((_, el) => {
                const text = $(el).text().trim();
                const href = $(el).attr('href');
                if (text && href) {
                    allLinks.push({ text, href: href.startsWith('http') ? href : `https://www.altinoluk.com.tr${href}` });
                }
            });

            // "Şubat 2026" metnini içeren linki bul
            const searchText = `${targetMonth} ${targetYear}`;
            const matchingLink = allLinks.find(l => l.text.includes(searchText));

            if (matchingLink) {
                // Sayı numarasını da bulmaya çalış (480. Sayı gibi)
                const issueMatch = bodyText.match(new RegExp(`${searchText}[\\s\\S]*?(\\d+)\\.\\s*Sayı`, 'i'));
                const issueNumber = issueMatch ? issueMatch[1] : '';

                return NextResponse.json({
                    found: true,
                    issueUrl: matchingLink.href,
                    issueNumber,
                    searchText
                });
            }

            // İlk sayfada bulunamadıysa, sayfalı arşivde sonraki sayfaları kontrol et
            // (Daha eski sayılar diğer sayfalarda olabilir)
            return NextResponse.json({
                found: false,
                searchText,
                message: `"${searchText}" arşiv sayfasında bulunamadı.`
            });
        }

        // ====================================================================
        // MODE: ISSUE - Bir sayı sayfasından makale listesini çek
        // Yeni site yapısında sayı sayfasında makaleler doğrudan link olarak
        // yazar isimleriyle birlikte sıralanıyor (tablo yok)
        // ====================================================================
        if (mode === 'issue') {
            const articles: any[] = [];

            // YÖNTEM 1: Yeni site yapısı - Makale ve yazar linkleri sıralı
            // Sayfadaki breadcrumb'dan sonraki kısımda makale ve yazar linkleri var
            // Her makale linki ardından yazar linki geliyor
            const allAnchors: { text: string; href: string }[] = [];
            $('a').each((_, el) => {
                const text = $(el).text().trim();
                const href = $(el).attr('href') || '';
                if (text && href && !href.includes('#')) {
                    allAnchors.push({ 
                        text, 
                        href: href.startsWith('http') ? href : `https://www.altinoluk.com.tr${href}` 
                    });
                }
            });

            // Yazar linklerini filtrele (yazar/ içerenler)
            // ve onların hemen öncesindeki linki makale olarak al
            const yazarIndexes = allAnchors
                .map((a, i) => a.href.includes('/yazar/') ? i : -1)
                .filter(i => i > 0);

            for (const yi of yazarIndexes) {
                const articleLink = allAnchors[yi - 1];
                const authorLink = allAnchors[yi];
                
                // Makale linki menü veya footer linki olmamalı
                if (articleLink && 
                    !articleLink.href.includes('/yazar/') && 
                    !articleLink.href.includes('/kategori/') &&
                    !articleLink.href.includes('/login') &&
                    !articleLink.href.includes('/register') &&
                    !articleLink.href.includes('/abonelik') &&
                    !articleLink.href.includes('/dergi-arsivi') &&
                    !articleLink.href.includes('/yazarlar') &&
                    !articleLink.href.includes('/kategoriler') &&
                    !articleLink.href.includes('/kunye') &&
                    !articleLink.href.includes('/iletisim') &&
                    !articleLink.href.includes('/arama') &&
                    !articleLink.href.includes('/hakkimizda') &&
                    !articleLink.href.includes('/yasal') &&
                    articleLink.text.length > 3) {
                    
                    // Mükerrer kontrolü
                    const alreadyExists = articles.some(a => a.kaynakURL === articleLink.href);
                    if (!alreadyExists) {
                        articles.push({ 
                            baslik: articleLink.text, 
                            kaynakURL: articleLink.href,
                            yazarAdi: authorLink.text 
                        });
                    }
                }
            }

            // YÖNTEM 2: Eski site yapısı (tablo bazlı) - Fallback
            if (articles.length === 0) {
                $('table tbody tr').each((_, tr) => {
                    const link = $(tr).find('a').first();
                    const title = link.text().trim();
                    const href = link.attr('href');
                    if (title && href) {
                        const fullUrl = href.startsWith('http') ? href : `https://www.altinoluk.com.tr${href}`;
                        articles.push({ baslik: title, kaynakURL: fullUrl });
                    }
                });
            }

            // YÖNTEM 3: Genel link arama - Son fallback
            if (articles.length === 0) {
                $('.list-post li, .post-block-style').each((_, li) => {
                    const link = $(li).find('a').first();
                    const title = link.text().trim();
                    const href = link.attr('href');
                    if (title && href && !href.includes('/yazar/')) {
                        const fullUrl = href.startsWith('http') ? href : `https://www.altinoluk.com.tr${href}`;
                        articles.push({ baslik: title, kaynakURL: fullUrl });
                    }
                });
            }

            console.log(`[SCRAPER] Issue mode: Found ${articles.length} articles at ${url}`);
            return NextResponse.json({ articles });
        }

        // ====================================================================
        // MODE: ARTICLE (Varsayılan) - Tek makale içeriğini çek
        // ====================================================================
        const baslik = $('.main-title').first().text().trim() || $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
        const yazarAdi = $('.post-author a').first().text().trim() || $('.author-info h3 a').first().text().trim() || $('.author').first().text().trim();
        const spot = $('.entry-spot').first().text().trim();

        let icerikHTML = '';
        const selectors = ['#content', '.entry-content', '.post-content-area', '.article-content', 'article'];
        let bestContainer = null;

        for (const sel of selectors) {
            const el = $(sel);
            if (el.length > 0) {
                if (el.text().trim().length > (bestContainer?.text().trim().length || 0)) {
                    bestContainer = el;
                }
            }
        }

        if (bestContainer) {
            const clone = bestContainer.clone();
            clone.find('.entry-spot, .alert, .alert-warning, .social-share, .author-box, .post-meta, script, style, .ads, .advertisement').remove();
            icerikHTML = clone.html()?.trim() || '';
        }

        const pageText = response.data.toLowerCase();
        const isTruncated =
            pageText.includes('abonelik gerekmektedir') ||
            pageText.includes('üye girişi yap') ||
            pageText.includes('abone olmak için tıklayınız') ||
            icerikHTML.length < 800;

        return NextResponse.json({
            baslik,
            yazarAdi,
            spot,
            icerikHTML,
            isTruncated,
            url
        });
    } catch (error: any) {
        console.error('Scrape error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
