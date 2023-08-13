require('dotenv/config');
const uri = "mongodb+srv://" + process.env.MONGO_USERNAME + ":" + process.env.MONGO_PASS + "@mongonews.0oh2nvc.mongodb.net/newsDB?retryWrites=true&w=majority";
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_KEY); // {polling: true}
/*
bot.on('polling_error', (error) => {
    console.log(error.code, error);
});
*/
mongoose.connect(uri, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    serverSelectionTimeoutMS: 5000 // Optional: timeout
});

let connectionStatus = false;

const db = mongoose.connection;
const newsSchema = new mongoose.Schema({
    img: String,
    link: String,
    time: String,
    title: String
});
const News = mongoose.model('news_collection', newsSchema);
db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', () => {
    console.log('Connected to mongo');
    connectionStatus = true;
    // Burada Mongoose kullanmaya başlayabilirsiniz
});

module.exports.saveNews = (json, callback) => {
    if (!connectionStatus) return callback('Mongo connection lost!', []);

    this.getNews( { "title": json.title}, (err, res) => {
        if (err) {
            console.error("getNews", err);
            return callback({code: 500, message: 'Internal Server Error'}, null);
        }
        if (res.length > 0) {
            console.log("found", res[0].title);
            return callback(null, true);
        } else {
            console.log("inserting...", json.title);
            News.create(json).then(result => {
                if (!process.env.PRODUCTION) console.log('Data inserted successfully:', result);
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

                json.title = json.title.replace(new RegExp('.', 'g'), '\\.'); //telegram bot error

                let title = json.title.split(' ');
                let lastWord = title.pop();
                title = title.join(' ');
                // '<b>' + time + '</b> - ' + 
                let messageText = '<b>' + title + '</b> <a href="https://www.haberler.com' + link + '">' + lastWord + '</a>';

                /*
                *bold \*text*
                _italic \*text_
                __underline__
                ~strikethrough~
                ||spoiler||
                *bold _italic bold ~italic bold strikethrough ||italic bold strikethrough spoiler||~ __underline italic bold___ bold*
                [inline URL](http://www.example.com/)
                [inline mention of a user](tg://user?id=123456789)
                ![👍](tg://emoji?id=5368324170671202286)
                `inline fixed-width code`
                ```
                pre-formatted fixed-width code block
                ```
                ```python
                pre-formatted fixed-width code block written in the Python programming language
                ```
                */
                messageText = title + ' ' + lastWord + ' [Haberin devamı](https://www.haberler.com' + link + ')';
                if (title && link) {
                    bot.sendPhoto(process.env.TELEGRAM_CHAT_ID, img, {
                        caption: messageText,
                        parse_mode: 'MARKDOWNV2', // 'HTML'
                    }).catch((error) => {
                        console.log(error.code);
                        console.log(error.response.body);
                    });
                }

                /*
                bot.sendMessage(process.env.TELEGRAM_CHAT_ID, img, {
                    caption: messageText,
                    parse_mode: 'Markdown', // Varsayılan metin biçimlendirme modu (Markdown veya HTML)
                });
                */
        
                callback(null, true);
            })
            .catch(err => {
                console.error('Error while inserting data:', err);
                callback(err, null);
            });
        }
    });
};

module.exports.getNews = (query, callback) => {
    if (!connectionStatus) return callback('Mongo connection lost!', []);
    News.find(query).then(result => {
        if (!process.env.PRODUCTION) console.log('getNews data:', result);
        callback(null, result);
    })
    .catch(err => {
        console.error('getNews error:', err);
        callback(err, null);
    });
};

async function refreshPage() {
    const url = 'https://www.haberler.com/son-dakika/';
    const refreshInterval = 90 * 1000;

    const refreshLoop = async () => {
        try {
            const browser = await puppeteer.launch(); //{headless: "new"}
    
            const openPages = await browser.pages();
            if (openPages.length > 0) {
                console.log('Current tab amount:', openPages.length);
                await Promise.all(openPages.map(page => page.close()));
                const closedPages = await browser.pages();
                console.log('Tab amount after cleaning:', closedPages.length);
            }

            const page = await browser.newPage();

            let temp = await browser.pages();
            console.log('New tab amount:', temp.length);


            if(bot.isPolling()) {
                console.log("checking: bot is polling")
                await bot.stopPolling();
                console.log("checking: polling stopped")
            }
            
            await bot.startPolling();
            console.log("polling started");

            if (page.frames().length == 0) {
                console.log('FRAMES DETACHED FROM PAGE!');
                // Burada ayrılan sayfayla ilgili işlemleri gerçekleştirebilirsiniz.
            } else {
                console.log('frames in page are alive, count:', page.frames().length);
                // Hala tarayıcıda olan sayfayla ilgili işlemleri gerçekleştirebilirsiniz.
            }
            
            await page.goto(url, { waitUntil: 'networkidle0' });
            if (!process.env.PRODUCTION) console.log('Page refreshed:', new Date());


            let dk = await page.$('.sondakikatxt');
            const timeText = await dk.evaluate(element => element.textContent);
            const timeRegex = /(\d{2}:\d{2}) itibariyle/; // Saat bilgisini içeren metni düzenli ifadeyle çıkarır
            const match = timeText.match(timeRegex);
        
            if (match && match.length >= 2) {
                dk = match[1];
                if (!process.env.PRODUCTION) console.log('Time:', dk);
            } else {
                if (!process.env.PRODUCTION) console.log('Time not found.');
            }

            //.split(' ').find(el => el.includes(':'));
            let arr = [];
            let elements = await page.$$('.hblnBox');
            elements = elements.length > 10 ? elements.slice(0, 10) : elements;
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
                    console.log('title:', title);
                    console.log('time:', time);
                    console.log('link:', link);
                }

                arr.push({
                    img: img,
                    title: title,
                    time: time,
                    link: link
                });
                //if (time == dk) {}
            }
            if (!process.env.PRODUCTION) console.log("finalArray ->", arr);
            console.log(dk, "-", arr.length, " data will be analysed");
            
            page.close();
            browser.close();
            
            saveList(arr, 0);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setTimeout(refreshLoop, refreshInterval);
        }
    };
  
    refreshLoop();
}

saveList = async (arr, counter) => {
    if (counter >= arr.length) {
        await bot.stopPolling();
        console.log("polling stopped");
        return;
    } 
    this.saveNews(arr[counter], (err, res) => {
        saveList(arr, counter + 1);
    });
}

refreshPage();