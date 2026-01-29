import * as admin from "firebase-admin";

const initAdmin = () => {
    if (admin.apps.length) return admin.app();

    try {
        return admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            }),
        });
    } catch (error) {
        console.error("Firebase admin initialization error", error);
        return null;
    }
};

const app = initAdmin();

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
