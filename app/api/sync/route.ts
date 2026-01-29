import { NextRequest, NextResponse } from "next/server";
import { scrapeTargetSite } from "@/lib/scraping";
import { adminDb } from "@/lib/firebase-admin";
import { decrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
    try {
        // 1. Check authorization (Admin only)
        // For now, we'll assume the request is authorized through Next.js middleware or session
        // In a real app, verify Firebase ID token from header

        // 2. Fetch site config from Firestore
        const configDoc = await adminDb.collection('config').doc('site-settings').get();

        if (!configDoc.exists) {
            return NextResponse.json({ error: "Site config not found" }, { status: 404 });
        }

        const { url, username, passwordEncrypted } = configDoc.data()!;
        const passwordDecrypted = decrypt(passwordEncrypted);

        // 3. Trigger Scraping
        console.log("Starting sync for site:", url);
        const result = await scrapeTargetSite(url, username, passwordDecrypted);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        // 4. Save to Firestore with Duplicate Prevention
        let savedCount = 0;
        const batch = adminDb.batch();

        for (const article of result.articles) {
            // Create a unique ID for duplicate prevention: slug of title + month + year
            const slug = article.baslik.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const docId = `${slug}-${article.ay}-${article.yil}`;
            const docRef = adminDb.collection('articles').doc(docId);

            const doc = await docRef.get();
            if (!doc.exists) {
                batch.set(docRef, {
                    ...article,
                    olusturmaTarihi: new Date(),
                });
                savedCount++;
            }
        }

        await batch.commit();

        // 5. Update last sync time
        await adminDb.collection('config').doc('site-settings').update({
            lastSync: new Date()
        });

        return NextResponse.json({
            success: true,
            count: savedCount,
            totalScraped: result.articles.length
        });

    } catch (error: any) {
        console.error("Sync API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
