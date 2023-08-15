require('dotenv/config');
const uri = "mongodb+srv://" + process.env.MONGO_USERNAME + ":" + process.env.MONGO_PASS + "@mongonews.0oh2nvc.mongodb.net/newsDB?retryWrites=true&w=majority";
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');

const botID = process.env.PRODUCTION == 'TRUE' ? process.env.TELEGRAM_BOT_KEY : process.env.TELEGRAM_BOT_KEY_TEST;
const chatID = process.env.PRODUCTION == 'TRUE' ? process.env.TELEGRAM_CHAT_ID : process.env.TELEGRAM_CHAT_ID_TEST;
const bot = new TelegramBot(botID); // {polling: true}
let browser, page;

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
    title: String,
    description: String,
    category: String
});
const News = mongoose.model('news_collection', newsSchema);
db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', () => {
    console.log('Connected to mongo');
    connectionStatus = true;
    // Burada Mongoose kullanmaya başlayabilirsiniz
    refreshPage();
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
            
            if (process.env.PRODUCTION == 'TRUE') {
                return callback(null, true);
            } else {
                sendMessage(json, (err, res) => callback(err, res));
            }
        } else {
            
            if (process.env.PRODUCTION == 'TRUE') {
                console.log("inserting...", json.title);
                News.create(json).then(result => {
                    console.log("inserted")
                    sendMessage(json, (err, res) => callback(err, res));
                })
                .catch(err => {
                    console.error('Error while inserting data:', err);
                    callback(err, null);
                });
            } else {
                sendMessage(json, (err, res) => callback(err, res));
            }
        }
    });
};

module.exports.getNews = (query, callback) => {
    if (!connectionStatus) return callback('Mongo connection lost!', []);
    News.find(query).then(result => {
        //if (process.env.PRODUCTION == 'FALSE') console.log('getNews data:', result);
        callback(null, result);
    })
    .catch(err => {
        console.error('getNews error:', err);
        callback(err, null);
    });
};

async function refreshPage() {
    const url = 'https://www.haberler.com/son-dakika/';
    const refreshInterval = 5 * 60 * 1000;
    browser = await puppeteer.launch({
        //ignoreHTTPSErrors: true,
        args: ["--ignore-certificate-errors"]
    }); //{headless: "new"}  // {args: ['--disable-features=site-per-process']}
    const openPages = await browser.pages();
    if (openPages.length > 0) {
        console.log('Current tab amount:', openPages.length);
        await Promise.all(openPages.map(page => page.close()));
        const closedPages = await browser.pages();
        console.log('Tab amount after cleaning:', closedPages.length);
    }

    let currentPages = await browser.pages();
    console.log('New tab amount:', currentPages.length);

    let firstPageOpened = false;
    let arr = [];
    const refreshLoop = async () => {
        try {
            page = await browser.newPage();
            /**
             *  export type PuppeteerLifeCycleEvent =
                | 'load'
                | 'domcontentloaded'
                | 'networkidle0'
                | 'networkidle2';
             */
            
            if (firstPageOpened && page.frames().length == 1) {
                console.log('FRAMES DETACHED FROM PAGE! count:', page.frames().length);
                // Burada ayrılan sayfayla ilgili işlemleri gerçekleştirebilirsiniz.
                //throw new Error("detached_frames");
                delay(5000);

            } else {
                console.log('frames in page are alive, count:', page.frames().length);
                // Hala tarayıcıda olan sayfayla ilgili işlemleri gerçekleştirebilirsiniz.
            }
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000});
            firstPageOpened = true;

            console.log("iframe silinecek");
            await page.evaluate(() => {
                (document.querySelectorAll('iframe') || document.querySelectorAll('frame')).forEach(el => el.remove());
            });
            console.log("iframe silindi");

            if (process.env.PRODUCTION == 'FALSE') console.log('Page refreshed:', new Date());

            let dk = await page.$('.sondakikatxt');
            const timeText = await dk.evaluate(element => element.textContent);
            const timeRegex = /(\d{2}:\d{2}) itibariyle/; // Saat bilgisini içeren metni düzenli ifadeyle çıkarır
            const match = timeText.match(timeRegex);
        
            if (match && match.length >= 2) {
                dk = match[1];
                if (process.env.PRODUCTION == 'FALSE') console.log('Time:', dk);
            } else {
                if (process.env.PRODUCTION == 'FALSE') console.log('Time not found.');
            }

            //.split(' ').find(el => el.includes(':'));
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


                if (process.env.PRODUCTION == 'FALSE') {
                    console.log('img src:', img);
                    console.log('title:', title);
                    console.log('time:', time);
                    console.log('link:', link);
                }

                arr.push({
                    img: img,
                    title: title,
                    time: time,
                    link: link,
                    description: "",
                    category: "",
                });
                //if (time == dk) {}
            }
            if (process.env.PRODUCTION == 'FALSE') console.log("finalArray ->", arr);
            console.log(dk, "-", arr.length, " data will be analysed");

        } catch (error) {
            console.error('Error:', error);
        } finally {
            await page.close();
            
            saveList(arr, 0);

            await delay(refreshInterval);
            refreshLoop();
            
            //await page.waitForTimeout(refreshInterval);
            //refreshLoop();
        }
    };
  
    refreshLoop();
}

sendMessage = async (json, callback) => {

    let img = json.img;
    let link = json.link;
    let time = json.time;
    let title = json.title.split(' ');
    let lastWord = title.pop();
    title = title.join(' ');

    console.log("details gelecek");
    let details = await getDescription(link);
    console.log("details geldi");
    let updateObj = {
        description: details.description, 
        category: details.category,
    }

    if (img.includes('Default') && details.img) {
        img = details.img.replace('_amp', '_o');
        updateObj['img'] = img;
    }


    const res = await News.updateOne({ title: json.title }, { $set: updateObj });
    console.log(res.acknowledged, "bilgisi geldi |", res.matchedCount, "adet buldum |", res.modifiedCount, "adet update ettim");

    /*
    News.updateOne(
        { title: json.title },
        { $set: updateObj },
        { new: true },
        (err, updatedItem) => {
            if (err) {
                console.error('Güncelleme hatası:', err);
            } else {
                console.log('Güncellenen kayıt:', updatedItem);
            }
        }
    );
    */

    
    if (details.description) {
        if (details.description.length > 200) {
            details.description = details.description.substring(0, 200) + '...';
        }
    }

    if (title && link && !img.includes('Default') && img != 'https://s.hbrcdn.com/mstatic/haberlercom_haberi.jpg') {
        // messageText = title + ' ' + lastWord;
        // if (details.description) messageText += '\n' + details.description;
        // messageText += '\n[Haberin devamı](https://www\.haberler\.com' + link + ')';

        messageText = title + ' ' + lastWord;
        if (details.description && details.description != title + ' ' + lastWord) messageText += '\n\n' + details.description;
        messageText += '\n\n<a href="https://www\.haberler\.com' + link + '">Haberin devamı</a>';

        bot.sendPhoto(chatID, img, {
            caption: messageText,
            parse_mode: 'HTML', // 'MARKDOWNV2'
        }).catch(error => {
            console.log(error.code);
            console.log(error.response.body.description);
        });
    } else if (title && link && img.includes('Default')) {
        //messageText = '<b>' + title + '</b> <a href="https://www.haberler.com' + link + '">' + lastWord + '</a>';
        // messageText = title + ' ' + lastWord;
        // if (details.description) messageText += '\n' + details.description;
        // messageText += '\n[Haberin devamı](https://www\.haberler\.com' + link + ')';

        messageText = title + ' ' + lastWord;
        if (details.description && details.description != title + ' ' + lastWord) messageText += '\n\n' + details.description;
        messageText += '\n\n<a href="https://www\.haberler\.com' + link + '">Haberin devamı</a>';

        bot.sendMessage(chatID, messageText, {
            parse_mode: 'HTML', // 'MARKDOWNV2'
            disable_web_page_preview: true
        }).catch((error) => {
            console.log(error);
        });
    } else {
        console.log("else")
    }
    callback(null, true);
}

getDescription = (link) => {
    return new Promise(async function(resolve, reject) {
        //console.log('\nDetay sayfası süreci başlıyor');
        const url = "https://www.haberler.com" + link;
        let description, category, img;
        let page;
        let pagePromise;
        try {
            console.log("detay yeni sekme açılacak");
            pagePromise = browser.newPage();
            page = await Promise.race([pagePromise, new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`browser.newPage() zaman aşımına uğradı.`));
            }, 10000);
            })]);
            
            if (!page) {
                console.log("detay yeni sekme açılamadı!");
                throw new Error(`browser.newPage() zaman aşımına uğradı.`);
            }

            if (page.frames().length == 1) {
                console.log('FRAMES DETACHED FROM DETAIL PAGE! count:', page.frames().length);
                // Burada ayrılan sayfayla ilgili işlemleri gerçekleştirebilirsiniz.
                //throw new Error("detached_frames");
                delay(5000);

            } else {
                console.log('frames in detail page are alive, count:', page.frames().length);
                // Hala tarayıcıda olan sayfayla ilgili işlemleri gerçekleştirebilirsiniz.
            }
            //page = await browser.newPage();
            console.log("detay linki açılacak");
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            console.log("detay linki açıldı");
            let descriptionElement = await page.$('.haber_spotu');
            description = descriptionElement ? await descriptionElement.evaluate(element => element.textContent) : null;
        
            let categoryElement = await page.$('.hbptHead_h2');
            category = categoryElement ? await categoryElement.evaluate(element => element.textContent) : null;
            
            let imgElement = await page.$('.hbptMainImage');
            img = imgElement ? await imgElement.evaluate(img => img.getAttribute('src')) : null;
        } catch (error) {
            console.log(error, link);
            category = null;
            description = null;
            img = null;
        } finally {
            await page.close();
            resolve({
                description: description,
                category: category,
                img: img
            });
        }

    })
}

saveList = (arr, counter) => {
    if (counter >= arr.length) return;
    this.saveNews(arr[counter], (err, res) => {
        saveList(arr, counter + 1);
    });
}

async function delay(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}
  