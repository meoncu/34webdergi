import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    orderBy,
    limit,
    doc,
    deleteDoc,
    updateDoc,
    writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import { Article } from "../types";

const COLLECTION_NAME = "articles";

export const articleService = {
    async getById(id: string) {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as Article;
        }
        return null;
    },

    async getByIds(ids: string[]) {
        if (!ids.length) return [];

        // Firestore 'in' queries are limited to 30 items
        // We fetch them in chunks if there are more
        const articles: Article[] = [];
        for (let i = 0; i < ids.length; i += 30) {
            const chunk = ids.slice(i, i + 30);
            const q = query(collection(db, COLLECTION_NAME), where("__name__", "in", chunk));
            const snapshot = await getDocs(q);
            articles.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Article[]);
        }

        // Return in the same order as IDs (which is 'recent' from bookmarks)
        return ids.map(id => articles.find(a => a.id === id)).filter(Boolean) as Article[];
    },

    async getAll(maxCount = 50) {
        try {
            console.log("Firestore: getAll starting for collection", COLLECTION_NAME);
            const q = query(
                collection(db, COLLECTION_NAME),
                limit(maxCount)
            );
            const snapshot = await getDocs(q);
            console.log("Firestore: getAll finished, docs found:", snapshot.size);
            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Article[];

            // Bellekte sıralama yapalım
            return docs.sort((a, b) => {
                const dateA = a.olusturmaTarihi?.toDate?.() || new Date(0);
                const dateB = b.olusturmaTarihi?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });
        } catch (error) {
            console.error("Firestore getAll Error:", error);
            throw error;
        }
    },

    async isArticleExists(url: string) {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("kaynakURL", "==", url)
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    },

    async upsertArticle(article: Omit<Article, "id" | "olusturmaTarihi">) {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("kaynakURL", "==", article.kaynakURL)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // Güncelle
                const docId = snapshot.docs[0].id;
                await updateDoc(doc(db, COLLECTION_NAME, docId), {
                    ...article,
                    guncellemeTarihi: serverTimestamp()
                });
                return { id: docId, type: 'updated' };
            } else {
                // Yeni ekle
                const result = await addDoc(collection(db, COLLECTION_NAME), {
                    ...article,
                    olusturmaTarihi: serverTimestamp()
                });
                return { id: result.id, type: 'added' };
            }
        } catch (error) {
            console.error("Firestore upsert Error:", error);
            throw error;
        }
    },

    async countArticlesByPeriod(year: number, month: string) {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("yil", "==", year),
            where("ay", "==", month)
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    },

    async updateArticle(id: string, article: Partial<Article>) {
        const docRef = doc(db, COLLECTION_NAME, id);
        return await updateDoc(docRef, article);
    },

    async deleteArticle(id: string) {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Firestore deleteArticle Error:", error);
            throw error;
        }
    },

    async deleteByPeriod(year: number, month: string) {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("yil", "==", year),
                where("ay", "==", month)
            );
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            return snapshot.size;
        } catch (error) {
            console.error("Firestore deleteByPeriod Error:", error);
            throw error;
        }
    },

    async getStats() {
        const q = query(collection(db, COLLECTION_NAME));
        const snapshot = await getDocs(q);
        const stats: Record<number, Record<string, { count: number; chars: number; words: number }>> = {};

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const year = data.yil;
            const month = data.ay;
            const content = (data.icerikHTML || data.icerikText || "");
            const charCount = content.length;
            const wordCount = content.split(/\s+/).filter(Boolean).length;

            if (year && month) {
                if (!stats[year]) stats[year] = {};
                if (!stats[year][month]) stats[year][month] = { count: 0, chars: 0, words: 0 };

                stats[year][month].count += 1;
                stats[year][month].chars += charCount;
                stats[year][month].words += wordCount;
            }
        });
        return stats;
    },

    async getByPeriod(year: number, month: string) {
        try {
            console.log(`Firestore: getByPeriod starting for ${year} ${month}`);
            const q = query(
                collection(db, COLLECTION_NAME),
                where("yil", "==", year),
                where("ay", "==", month)
            );
            const snapshot = await getDocs(q);
            console.log(`Firestore: getByPeriod finished, found ${snapshot.size} docs`);

            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Article[];

            return docs.sort((a, b) => {
                const dateA = a.olusturmaTarihi?.toDate?.() || new Date(0);
                const dateB = b.olusturmaTarihi?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });
        } catch (error) {
            console.error("Firestore getByPeriod Error:", error);
            throw error;
        }
    }
};
