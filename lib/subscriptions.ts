import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy,
    serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { SubscriptionSite } from "../types";

const COLLECTION_NAME = "subscriptions";

export const subscriptionService = {
    async getAll() {
        try {
            console.log("Firestore: getAll starting for collection", COLLECTION_NAME);
            const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            console.log("Firestore: getAll finished, docs found:", snapshot.size);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as SubscriptionSite[];
        } catch (error) {
            console.error("Firestore getAll Error:", error);
            throw error;
        }
    },

    async add(site: Omit<SubscriptionSite, "id" | "createdAt">) {
        try {
            console.log("Firestore: addDoc starting for collection", COLLECTION_NAME);
            const result = await addDoc(collection(db, COLLECTION_NAME), {
                ...site,
                createdAt: serverTimestamp()
            });
            console.log("Firestore: addDoc finished, id:", result.id);
            return result;
        } catch (error) {
            console.error("Firestore add Error:", error);
            throw error;
        }
    },

    async update(id: string, site: Partial<SubscriptionSite>) {
        const docRef = doc(db, COLLECTION_NAME, id);
        return await updateDoc(docRef, site);
    },

    async delete(id: string) {
        const docRef = doc(db, COLLECTION_NAME, id);
        return await deleteDoc(docRef);
    }
};
