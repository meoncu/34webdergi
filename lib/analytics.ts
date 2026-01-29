import { db } from "./firebase";
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
    orderBy,
    limit,
    getCountFromServer,
    deleteDoc,
    doc
} from "firebase/firestore";
import { Activity, Comment, Like } from "../types";

const ACTIVITIES_COL = "activities";
const COMMENTS_COL = "comments";
const LIKES_COL = "likes";

export const analyticsService = {
    async logActivity(activity: Omit<Activity, "id" | "timestamp">) {
        try {
            await addDoc(collection(db, ACTIVITIES_COL), {
                ...activity,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Log activity error:", error);
        }
    },

    async getRecentActivities(max = 50) {
        const q = query(
            collection(db, ACTIVITIES_COL),
            orderBy("timestamp", "desc"),
            limit(max)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Activity[];
    },

    async getUserActivities(userId: string) {
        const q = query(
            collection(db, ACTIVITIES_COL),
            where("userId", "==", userId),
            orderBy("timestamp", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Activity[];
    },

    // Reading Stats
    async getArticleReadCount(articleId: string) {
        const q = query(
            collection(db, ACTIVITIES_COL),
            where("articleId", "==", articleId),
            where("type", "==", "read")
        );
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    },

    // Likes
    async toggleLike(articleId: string, userId: string, userName: string, userEmail: string, articleTitle: string) {
        const q = query(
            collection(db, LIKES_COL),
            where("articleId", "==", articleId),
            where("userId", "==", userId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Un-like
            await deleteDoc(doc(db, LIKES_COL, snapshot.docs[0].id));
            return false;
        } else {
            // Like
            await addDoc(collection(db, LIKES_COL), {
                articleId,
                userId,
                createdAt: serverTimestamp()
            });
            await this.logActivity({
                type: 'like',
                userId,
                userName,
                userEmail,
                articleId,
                articleTitle
            });
            return true;
        }
    },

    async getLikeCount(articleId: string) {
        const q = query(collection(db, LIKES_COL), where("articleId", "==", articleId));
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    },

    async isLiked(articleId: string, userId: string) {
        const q = query(
            collection(db, LIKES_COL),
            where("articleId", "==", articleId),
            where("userId", "==", userId)
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    },

    // Comments
    async addComment(comment: Omit<Comment, "id" | "createdAt">, userEmail: string, articleTitle: string) {
        try {
            const res = await addDoc(collection(db, COMMENTS_COL), {
                ...comment,
                createdAt: serverTimestamp()
            });

            // Log as activity in the background
            this.logActivity({
                type: 'comment',
                userId: comment.userId,
                userName: comment.userName,
                userEmail,
                articleId: comment.articleId,
                articleTitle,
                content: comment.text
            }).catch(e => console.error("Activity log failed:", e));

            return res.id;
        } catch (error) {
            console.error("Add comment firestore error:", error);
            throw error;
        }
    },

    async getComments(articleId: string) {
        const q = query(
            collection(db, COMMENTS_COL),
            where("articleId", "==", articleId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Comment[];
    },

    // Bookmarks
    async toggleBookmark(articleId: string, userId: string) {
        const q = query(
            collection(db, "bookmarks"),
            where("articleId", "==", articleId),
            where("userId", "==", userId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            await deleteDoc(doc(db, "bookmarks", snapshot.docs[0].id));
            return false;
        } else {
            await addDoc(collection(db, "bookmarks"), {
                articleId,
                userId,
                createdAt: serverTimestamp()
            });
            return true;
        }
    },

    async isBookmarked(articleId: string, userId: string) {
        const q = query(
            collection(db, "bookmarks"),
            where("articleId", "==", articleId),
            where("userId", "==", userId)
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    }
};
