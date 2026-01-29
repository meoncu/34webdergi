import { db } from "./firebase";
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from "firebase/firestore";
import { User } from "../types";

const COLLECTION_NAME = "users";

export const userService = {
    async syncUser(firebaseUser: any) {
        if (!firebaseUser) return null;

        const userRef = doc(db, COLLECTION_NAME, firebaseUser.uid);
        const userDoc = await getDoc(userRef);

        const userData: Partial<User> = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || "",
            lastLogin: serverTimestamp(),
            role: firebaseUser.email === 'meoncu@gmail.com' ? 'admin' : 'user'
        };

        if (!userDoc.exists()) {
            await setDoc(userRef, userData);
        } else {
            await setDoc(userRef, userData, { merge: true });
        }

        return { ...userData, id: firebaseUser.uid } as User;
    },

    async getUser(uid: string) {
        const userRef = doc(db, COLLECTION_NAME, uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            return { uid: userDoc.id, ...userDoc.data() } as unknown as User;
        }
        return null;
    },

    async getAllUsers() {
        const q = query(collection(db, COLLECTION_NAME), orderBy("lastLogin", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as unknown as User[];
    }
};
