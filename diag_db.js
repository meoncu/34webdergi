
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase configuration in .env.local");
    process.exit(1);
}

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });

    const db = admin.firestore();

    async function checkDb() {
        console.log("Checking Firestore...");
        const articlesRef = db.collection('articles');
        const snapshot = await articlesRef.get();
        console.log(`Total articles in 'articles' collection: ${snapshot.size}`);

        if (snapshot.size > 0) {
            console.log("\nSample Article Details:");
            const first = snapshot.docs[0].data();
            console.log(`- Title: ${first.baslik}`);
            console.log(`- Year: ${first.yil} (type: ${typeof first.yil})`);
            console.log(`- Month: ${first.ay}`);
            console.log(`- Content Length: ${first.icerikHTML?.length || 0}`);
        }

        const subsRef = db.collection('subscriptions');
        const subsSnapshot = await subsRef.get();
        console.log(`Total subscriptions: ${subsSnapshot.size}`);

        process.exit(0);
    }

    checkDb();
} catch (error) {
    console.error("Diagnostic failed:", error);
    process.exit(1);
}
