import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    const mode = req.nextUrl.searchParams.get('mode'); // 'article' (default) or 'issue'
    const cookieString = req.nextUrl.searchParams.get('cookie'); // Can be full cookie string or just PHPSESSID

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
            // If it doesn't contain '=', assume it's just the PHPSESSID value
            headers['Cookie'] = cookieString.includes('=') ? cookieString : `PHPSESSID=${cookieString}`;
        }

        const response = await axios.get(url, { headers, timeout: 15000 });
        const $ = cheerio.load(response.data);

        // MODE: ISSUE (Discover all articles in a magazine issue)
        if (mode === 'issue') {
            const articles: any[] = [];
            // Looking at the structure from our dump, items are in tables or list-post
            // Best bet is checking the table inside the archive page
            $('table tbody tr').each((_, tr) => {
                const link = $(tr).find('a').first();
                const title = link.text().trim();
                const href = link.attr('href');
                if (title && href) {
                    const fullUrl = href.startsWith('http') ? href : `https://www.altinoluk.com.tr${href}`;
                    articles.push({ baslik: title, kaynakURL: fullUrl });
                }
            });

            // Fallback for different templates
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

            return NextResponse.json({ articles });
        }

        // MODE: ARTICLE (Fetch single article content)
        // Core Meta
        const baslik = $('.main-title').first().text().trim() || $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
        const yazarAdi = $('.post-author a').first().text().trim() || $('.author-info h3 a').first().text().trim() || $('.author').first().text().trim();
        const spot = $('.entry-spot').first().text().trim();

        // Content Extraction
        let icerikHTML = '';

        // Try to find the best container
        const selectors = ['#content', '.entry-content', '.post-content-area', '.article-content', 'article'];
        let bestContainer = null;

        for (const sel of selectors) {
            const el = $(sel);
            if (el.length > 0) {
                // Check if this container has substantial text
                if (el.text().trim().length > (bestContainer?.text().trim().length || 0)) {
                    bestContainer = el;
                }
            }
        }

        if (bestContainer) {
            const clone = bestContainer.clone();
            // Remove non-content elements
            clone.find('.entry-spot, .alert, .alert-warning, .social-share, .author-box, .post-meta, script, style, .ads, .advertisement').remove();

            // If there's an "abonelik gerekmektedir" alert or similar subscribe-to-read text, 
            // the content is likely incomplete unless authorized.
            icerikHTML = clone.html()?.trim() || '';
        }

        // Check for truncation or paywall
        const pageText = response.data.toLowerCase();
        const isTruncated =
            pageText.includes('abonelik gerekmektedir') ||
            pageText.includes('üye girişi yap') ||
            pageText.includes('abone olmak için tıklayınız') ||
            icerikHTML.length < 800; // Increased threshold for "full content" check

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
