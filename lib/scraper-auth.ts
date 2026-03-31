import { chromium } from 'playwright';

let cachedCookie: string | null = null;
let isAuthenticating = false;

export async function getAuthCookie(): Promise<string | null> {
    if (cachedCookie) {
        return cachedCookie;
    }

    const email = process.env.ALTINOLUK_EMAIL;
    const password = process.env.ALTINOLUK_PASSWORD;

    if (!email || !password) {
        console.warn('ALTINOLUK_EMAIL veya ALTINOLUK_PASSWORD .env dosyasında bulunamadı. Otomatik giriş atlandı.');
        return null;
    }

    if (isAuthenticating) {
        // Zaten giriş yapılıyorsa biraz bekle
        for(let i=0; i<30; i++) {
           await new Promise(r => setTimeout(r, 1000));
           if(cachedCookie) return cachedCookie;
           if(!isAuthenticating) break;
        }
    }

    try {
        isAuthenticating = true;
        console.log('Otomatik giriş için sanal tarayıcı başlatılıyor...');
        
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        // Altınoluk giriş sayfasına git (site genellikle /giris, /login veya anasayfada form olabilir)
        // Eğer link yanlışsa sistem ana sayfaya yönlenecektir.
        await page.goto('https://www.altinoluk.com.tr/giris', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(2000); // Sayfanın kendine gelmesini bekle
        
        // Sayfada input alanlarını bul (kullanıcı veya email olabilir)
        const emailInput = await page.$('input[type="email"], input[name="email"], input[id="email"], input[name="kullanici_adi"], input[name="username"]');
        const passInput = await page.$('input[type="password"], input[name="password"], input[id="password"], input[name="sifre"]');
        
        if (emailInput && passInput) {
            console.log("Form alanları bulundu, dolduruluyor...");
            await emailInput.fill(email);
            await passInput.fill(password);
            
            // Enter tuşu ile formu gönder
            await passInput.press('Enter');
            console.log("Form gönderildi, giriş bekleniyor...");
            
            // Yönlendirme veya işlemin tamamlanması için bekle
            await page.waitForTimeout(5000); 
        } else {
            console.log("Giriş form alanları bulunamadı! Tarayıcıda manuel kontrol gerekebilir.");
        }
        
        // Çerezleri al
        const cookies = await context.cookies();
        const phpsessid = cookies.find(c => c.name.toLowerCase() === 'phpsessid');
        
        if (phpsessid) {
            cachedCookie = `PHPSESSID=${phpsessid.value}`;
            console.log('Başarıyla PHPSESSID yakalandı:', cachedCookie.substring(0, 20) + '...');
        } else {
            console.log('PHPSESSID bulunamadı, mevcut tüm çerezler toplanıyor.');
            const allCooks = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            if (allCooks.length > 0) {
                cachedCookie = allCooks;
            }
        }
        
        await browser.close();
        isAuthenticating = false;
        return cachedCookie;
    } catch (error) {
        console.error('Otomatik giriş sunucuda hata ile karşılaştı:', error);
        isAuthenticating = false;
        return null;
    }
}
