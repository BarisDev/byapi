require('dotenv/config');
const uri = "mongodb+srv://" + process.env.MONGO_USERNAME + ":" + process.env.MONGO_PASS + "@mongonews.0oh2nvc.mongodb.net/newsDB?retryWrites=true&w=majority";
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_KEY, {polling: true});

mongoose.connect(uri, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    serverSelectionTimeoutMS: 5000 // İsteğe bağlı: Sunucu seçimi zaman aşımı
});

let connectionStatus = false;
// Bağlantı başarılı veya hatalı olduğunda bildirim
const db = mongoose.connection;
const newsSchema = new mongoose.Schema({
    img: String,
    link: String,
    time: String,
    title: String
});
const News = mongoose.model('news_collection', newsSchema);
db.on('error', console.error.bind(console, 'Bağlantı Hatası:'));
db.once('open', () => {
    console.log('Veritabanına bağlanıldı');
    connectionStatus = true;
    // Burada Mongoose kullanmaya başlayabilirsiniz
});

module.exports.saveNews = (json, callback) => {
    if (!connectionStatus) return callback('Mongo connection lost!', []);
    // Veri eklemek için create metodu kullanılır
    //json = JSON.parse(json);

    News.create(json).then(result => {
        if (!process.env.PRODUCTION) console.log('Veri başarıyla eklendi:', result);
        /*
        const boldText = 'Kalın vurgulu metin';
        const italicText = 'İtalik vurgulu metin';
        const codeText = 'Kod parçası';
        const formattedMessage = `
        *boldText*
        _italicText_
        \`codeText\`
        `;
        */

        let img = json.img;
        let link = json.link;
        let time = json.time;
        
        let title = json.title.split(' ');
        let lastWord = title.pop();
        title = title.join(' ');
        let messageText = '*' + time + '* - ' + title + ' [' + lastWord + '](' + link + ')';
        
        // [Google](https://www.google.com)

        bot.sendPhoto(process.env.TELEGRAM_CHAT_ID, img, {
            caption: messageText,
            parse_mode: 'Markdown', // Varsayılan metin biçimlendirme modu (Markdown veya HTML)
        });

        /*
        bot.sendMessage(process.env.TELEGRAM_CHAT_ID, img, {
            caption: messageText,
            parse_mode: 'Markdown', // Varsayılan metin biçimlendirme modu (Markdown veya HTML)
        });
        */

        callback(null, true);
    })
    .catch(err => {
        console.error('Veri eklenirken hata oluştu:', err);
        callback(err, null);
    });
};

module.exports.getNews = (time, callback) => {
    if (!connectionStatus) return callback('Mongo connection lost!', []);
    News.find({ time: time }).then(result => {
        if (!process.env.PRODUCTION) console.log('Veri başarıyla getirildi:', result);
        callback(null, result);
    })
    .catch(err => {
        console.error('Veri getirilirken hata oluştu:', err);
        callback(err, null);
    });
};


async function refreshPage() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    const url = 'https://www.haberler.com/son-dakika/';
    const refreshInterval = 60 * 1000;
    
    const refreshLoop = async () => {
        await page.goto(url, { waitUntil: 'networkidle0' });
        if (!process.env.PRODUCTION) console.log('Sayfa yenilendi:', new Date());
        
        let dk = await page.$('.sondakikatxt');
        const timeText = await dk.evaluate(element => element.textContent);
        const timeRegex = /(\d{2}:\d{2}) itibariyle/; // Saat bilgisini içeren metni düzenli ifadeyle çıkarır
        const match = timeText.match(timeRegex);
      
        if (match && match.length >= 2) {
          dk = match[1];
          console.log('Saat:', dk);
        } else {
          console.log('Saat bulunamadı.');
        }

        //.split(' ').find(el => el.includes(':'));
        let arr = [];
        
        const elements = await page.$$('.hblnBox');
        for (const element of elements) {
            const imgElement = await element.$('img');//.evaluate(img => img.getAttribute('src'));
            const img = imgElement ? await imgElement.evaluate(img => img.getAttribute('src')) : null;
            
            const titleElement = await element.$('.hblnContent');
            const title = titleElement ? await titleElement.evaluate(title => title.textContent) : null;

            const timeElement = await element.$('.hblnTime');
            const time = timeElement ? await timeElement.evaluate(time => time.textContent) : null;

            const linkElement = await element.$('a');
            const link = linkElement ? await linkElement.evaluate(a => a.getAttribute('href')) : null;

            if (!process.env.PRODUCTION) {
                console.log('img src:', img);
                console.log('hblnContent:', title);
                console.log('hblnTime:', time);
                console.log('link:', link);
            }

            if (time == dk) {
                arr.push({
                    img: img,
                    title: title,
                    time: time,
                    link: link
                });
            }
        }
        if (!process.env.PRODUCTION) console.log("finalArray ->", arr);
        console.log(dk, "-", arr.length, "adet içeri girecek");
        saveList(arr, 0);
        
        setTimeout(refreshLoop, refreshInterval);
    };

    refreshLoop();
}

saveList = (arr, counter) => {
    if (counter >= arr.length) return;
    this.saveNews(arr[counter], (err, res) => {
        saveList(arr, counter + 1);
    });
}

refreshPage();