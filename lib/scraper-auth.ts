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

        // Altınoluk giriş sayfası ( /login artık doğrulandı )
        console.log('Giriş sayfasına gidiliyor: https://www.altinoluk.com.tr/login');
        await page.goto('https://www.altinoluk.com.tr/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(3000); // Sayfanın kendine gelmesini bekle
        
        // Sayfada input alanlarını bul
        const emailInput = await page.$('input[type="email"], input[name="email"], input[id="email"], input[name="kullanici_adi"], input[name="username"]');
        const passInput = await page.$('input[type="password"], input[name="password"], input[id="password"], input[name="sifre"]');
        
        if (emailInput && passInput) {
            console.log("Form alanları bulundu, dolduruluyor...");
            await emailInput.fill(email);
            await passInput.fill(password);
            
            // Enter tuşu ile formu gönder
            await passInput.press('Enter');
            console.log("Form gönderildi, giriş bekleniyor...");
            
            // Yönlendirme ve başarılı giriş için bekle
            // Bekleme süresi artırıldı ve networkidle eklendi
            await page.waitForTimeout(7000); 
        } else {
            console.log("Giriş form alanları bulunamadı!");
        }
        
        // Çerezleri al
        const cookies = await context.cookies();
        
        // Laravel veya PHP bazlı sistemlerde session ismi değişebilir
        // Hepsini birleştirip göndermek en güvenlisi
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        if (cookieStr) {
            cachedCookie = cookieStr;
            console.log('Başarıyla çerezler yakalandı.');
        } else {
            console.log('Çerez yakalanamadı.');
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
