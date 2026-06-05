import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getAuthCookie } from '@/lib/scraper-auth';

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    const mode = req.nextUrl.searchParams.get('mode'); // 'article', 'issue', or 'discover'
    let cookieString = req.nextUrl.searchParams.get('cookie');
    const refresh = req.nextUrl.searchParams.get('refresh') === 'true';

    // Eğer dışarıdan cookie verilmediyse otomatik giriş mekanizmasını kullan
    if (!cookieString) {
        const autoCookie = await getAuthCookie(refresh);
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
        const pageTitle = $('title').text();
        const bodyText = $('body').text().toLowerCase();
        
        // Giriş sayfasına yönlendirilip yönlendirilmediğimizi kontrol et
        const isLoginPage = 
            bodyText.includes('giriş yap') && 
            (bodyText.includes('e-posta') || bodyText.includes('şifre')) &&
            !bodyText.includes('çıkış yap');

        if (isLoginPage) {
            console.log(`[SCRAPER] Login required for ${url}`);
            return NextResponse.json({ 
                error: 'Oturum açılması gerekiyor. Lütfen abonelik bilgilerini kontrol edin veya çerezleri yenileyin.',
                isTruncated: true,
                url
            });
        }

        const baslik = $('.main-title').first().text().trim() || $('h1').first().text().trim() || pageTitle.split('|')[0].trim();
        const yazarAdi = $('.post-author a').first().text().trim() || $('.author-info h3 a').first().text().trim() || $('.author').first().text().trim();
        const spot = $('.entry-spot').first().text().trim();

        let icerikHTML = '';
        const selectors = [
            '#content', 
            '.entry-content', 
            '.post-content-area', 
            '.article-content', 
            'article',
            '.post-content',
            '.text-content',
            '.entry-content-all',
            '.detail-content', // Yeni eklenen
            '.post-body'       // Yeni eklenen
        ];
        let bestContainer = null;

        for (const sel of selectors) {
            const el = $(sel);
            if (el.length > 0) {
                const textLen = el.text().trim().length;
                if (textLen > (bestContainer?.text().trim().length || 0)) {
                    bestContainer = el;
                }
            }
        }

        // Eğer hala bulunamadıysa ama sayfa yüklendiyse, p etiketlerini topla
        if (!bestContainer || bestContainer.text().trim().length < 200) {
            const paragraphs = $('p');
            if (paragraphs.length > 5) {
                // En çok p içeren kapsayıcıyı bulmaya çalış
                const parents = new Map();
                paragraphs.each((_, p) => {
                    const parent = $(p).parent();
                    const count = (parents.get(parent) || 0) + 1;
                    parents.set(parent, count);
                });
                let maxCount = 0;
                parents.forEach((count, parent) => {
                    if (count > maxCount) {
                        maxCount = count;
                        bestContainer = parent;
                    }
                });
            }
        }

        if (bestContainer) {
            const clone = bestContainer.clone();
            // Gereksiz alanları temizle
            clone.find('.entry-spot, .alert, .alert-warning, .social-share, .author-box, .post-meta, script, style, .ads, .advertisement, .related-posts, .comments-area, .sidebar, footer, header, nav').remove();
            icerikHTML = clone.html()?.trim() || '';
        }

        const pageText = response.data.toLowerCase();
        const isTruncated =
            pageText.includes('abonelik gerekmektedir') ||
            pageText.includes('üye girişi yap') ||
            pageText.includes('abone olmak için tıklayınız') ||
            (icerikHTML.length < 300 && pageText.includes('devamını okumak için')); 

        console.log(`[SCRAPER] Article mode: ${baslik} (${icerikHTML.length} chars) - Truncated: ${isTruncated}`);

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
