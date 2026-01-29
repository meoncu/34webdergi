const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkArticles() {
    const snapshot = await db.collection('articles')
        .where('yil', '==', 2025)
        .where('ay', '==', 'Aralık')
        .get();

    console.log(`Found ${snapshot.size} articles for Dec 2025`);
    snapshot.forEach(doc => {
        console.log(`- ${doc.data().baslik} (${doc.data().kaynakURL})`);
    });
}

checkArticles().catch(console.error);
