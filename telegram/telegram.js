require('dotenv/config');
const uri = "mongodb+srv://" + process.env.MONGO_USERNAME + ":" + process.env.MONGO_PASS + "@mongonews.0oh2nvc.mongodb.net/newsDB?retryWrites=true&w=majority";
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');

const botID = process.env.PRODUCTION == 'TRUE' ? process.env.TELEGRAM_BOT_KEY : process.env.TELEGRAM_BOT_KEY_TEST;
const chatID = process.env.PRODUCTION == 'TRUE' ? process.env.TELEGRAM_CHAT_ID : process.env.TELEGRAM_CHAT_ID_TEST;
const bot = new TelegramBot(botID); // {polling: true}
let browser, page, msgProcessCounter = 0, sendCounter = 0;

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
                return callback(null, true);
                sendMessage(json, (err, res) => callback(err, res));
            }
        } else {
            if (process.env.PRODUCTION == 'TRUE') {
                //console.log("inserting...", json.title);
                News.create(json).then(result => {
                    //console.log("inserted", json.title);
                    if (msgProcessCounter == 0 && sendCounter == 0) {
                        sendCounter++;
                        sendMessage(json, (err, res) => callback(err, res));
                    } else callback(null, true);
                    
                })
                .catch(err => {
                    console.error('Error while inserting data:', json.title, err);
                    callback(err, null);
                });
            } else {
                if (msgProcessCounter == 0 && sendCounter == 0) {
                    sendCounter++;
                    sendMessage(json, (err, res) => callback(err, res));
                } else {
                    callback(null, true);
                }
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
    const refreshInterval = 30 * 1000;
    browser = await puppeteer.launch({
        //ignoreHTTPSErrors: true,
        args: ["--ignore-certificate-errors"]
    }); //{headless: "new"}  // {args: ['--disable-features=site-per-process']}

    let firstPageOpened = false;

    let arr = [];
    const refreshLoop = async () => {
        try {
            page = await browser.newPage();

            if (msgProcessCounter == 5) {
                msgProcessCounter = 0;
                sendCounter = 0;
            } 
            else msgProcessCounter++;

            await delay(10 * 1000);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000}); //60000
            firstPageOpened = true;

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
            }
            if (process.env.PRODUCTION == 'FALSE') console.log("finalArray ->", arr);
            console.log(dk, "-", arr.length, " data will be analysed");

        } catch (error) {
            console.error('Error:', error);
        } finally {
            let status = await page.isClosed();
            if (!status) await page.close();

            saveList(arr, 0, async (err, res) => {
                arr = [];
                await delay(refreshInterval);
                refreshLoop();
            });
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

    let details = await getDescription(link);
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
    
    if (details.description) {
        if (details.description.length > 200) {
            details.description = details.description.substring(0, 200) + '...';
        }
    }
        
    if (title && link && !img.includes('Default') && img != 'https://s.hbrcdn.com/mstatic/haberlercom_haberi.jpg') {
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
        try {
            page = await browser.newPage();
            /*
            if (page.frames().length == 1) {
                console.log('FRAMES DETACHED FROM DETAIL PAGE! count:', page.frames().length);
                // Burada ayrılan sayfayla ilgili işlemleri gerçekleştirebilirsiniz.
                //throw new Error("detached_frames");
                await delay(10 * 1000);

            } else {
                console.log('frames in detail page are alive, count:', page.frames().length);
                // Hala tarayıcıda olan sayfayla ilgili işlemleri gerçekleştirebilirsiniz.
            }
            */
            await delay(10 * 1000);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
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
            let status = await page.isClosed();
            if (!status) await page.close();
            
            resolve({
                description: description,
                category: category,
                img: img
            });
        }
    });
}

saveList = (arr, counter, callback) => {
    if (counter >= arr.length) {
        return callback(null, true);
    }
    this.saveNews(arr[counter], (err, res) => {
        saveList(arr, counter + 1, callback);
    });
}

async function delay(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}