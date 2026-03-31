import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getAuthCookie } from '@/lib/scraper-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const { id, url } = await req.json();

        if (!id || !url) {
            return NextResponse.json({ error: 'ID and URL are required' }, { status: 400 });
        }

        console.log(`[REFRESH] Refreshing article ${id} from ${url}`);

        // 1. Get Authentication Cookie
        const cookieString = await getAuthCookie();
        
        const headers: any = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        };

        if (cookieString) {
            headers['Cookie'] = cookieString;
        }

        // 2. Scrape Article
        const response = await axios.get(url, { headers, timeout: 15000 });
        const $ = cheerio.load(response.data);

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

        if (!icerikHTML || icerikHTML.length < 200) {
            return NextResponse.json({ 
                error: 'İçerik çekilemedi veya çok kısa. Giriş yapılmamış olabilir.',
                html: response.data.substring(0, 500)
            }, { status: 500 });
        }

        // 3. Update Firestore
        await adminDb.collection('articles').doc(id).update({
            baslik,
            yazarAdi,
            spot,
            icerikHTML,
            guncellemeTarihi: new Date(),
            isTruncated: false
        });

        console.log(`[REFRESH] Successfully updated article ${id}`);

        return NextResponse.json({ 
            success: true, 
            message: 'Makale başarıyla güncellendi.',
            contentLength: icerikHTML.length
        });

    } catch (error: any) {
        console.error('[REFRESH] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
