require('dotenv/config');
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://" + process.env.MONGO_USERNAME + ":" + process.env.MONGO_PASS + "@mongonews.0oh2nvc.mongodb.net/newsDB?retryWrites=true&w=majority";
const mongoose = require('mongoose');

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
    
    News.create(json).then(result => {
        console.log('Veri başarıyla eklendi:', result);
        callback(null, result);
    })
    .catch(err => {
        console.error('Veri eklenirken hata oluştu:', err);
        callback(err, null);
    });
};

module.exports.getNews = (time, callback) => {
    if (!connectionStatus) return callback('Mongo connection lost!', []);
    News.find({ time: time }).then(result => {
        console.log('Veri başarıyla getirildi:', result);
        callback(null, result);
    })
    .catch(err => {
        console.error('Veri getirilirken hata oluştu:', err);
        callback(err, null);
    });
};
