const axios = require('axios');
const cheerio = require('cheerio');

async function testScrape(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);

        console.log('--- Title ---');
        console.log($('h1').text().trim());

        console.log('--- Author ---');
        // Let's look for common author patterns
        console.log($('.yazar-adi, .author, [itemprop="author"]').text().trim());

        console.log('--- Content (P tags) ---');
        $('p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50) {
                console.log(`P[${i}]: ${text.substring(0, 100)}...`);
            }
        });

        // Let's try to find the container
        const possibleContainers = ['.article-content', '.entry-content', '#content', 'article', '.content'];
        possibleContainers.forEach(selector => {
            if ($(selector).length > 0) {
                console.log(`Found container: ${selector}`);
            }
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testScrape('https://www.altinoluk.com.tr/olmeyecegiz.html');
