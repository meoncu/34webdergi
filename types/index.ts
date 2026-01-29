
export interface Article {
    id?: string;
    dergiSayisi: string;
    yil: number;
    ay: string;
    hicriYil?: string;
    yazarAdi: string;
    baslik: string;
    kategori?: string;
    yayinTarihi: string;
    icerikHTML: string;
    icerikText: string;
    kaynakURL: string;
    olusturmaTarihi: any;
}

export interface SubscriptionSite {
    id?: string;
    name: string;
    url: string;
    username: string;
    passwordEncrypted: string;
    createdAt: any;
}

export interface SiteConfig {
    activeSubscriptionId?: string;
    lastSync?: any;
}

export interface User {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    role: 'admin' | 'user';
}
