require('dotenv/config');
const uri = "mongodb+srv://" + process.env.MONGO_USERNAME + ":" + process.env.MONGO_PASS + "@mongonews.0oh2nvc.mongodb.net/newsDB?retryWrites=true&w=majority";
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');

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
    // Veri eklemek için create metodu kullanma
    json = JSON.parse(json);

    json.forEach(el => {
        News.create(el).then(result => {
            if (!process.env.PRODUCTION) console.log('Veri başarıyla eklendi:', result);
            /*
            const boldText = 'Kalın vurgulu metin';
            const italicText = 'İtalik vurgulu metin';
            const codeText = 'Kod parçası';
            const formattedMessage = `
            *${boldText}*
            _${italicText}_
            \`${codeText}\`
            `;
            */

            let img = el.img;
            let link = el.link;
            let time = el.time;
            let title = el.title;
            let lastWord = title.split(' ').pop();
            let messageText = '*${' + time + '}* - ' + title + '[' + lastWord + '](${ ' + link + '}) '
            bot.sendMessage(process.env.TELEGRAM_CHAT_ID, img, {
                caption: messageText,
                parse_mode: 'Markdown', // Varsayılan metin biçimlendirme modu (Markdown veya HTML)
            });

            callback(null, result);
        })
        .catch(err => {
            console.error('Veri eklenirken hata oluştu:', err);
            callback(err, null);
        });
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
