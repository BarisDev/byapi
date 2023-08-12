const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.text());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if ('OPTIONS' == req.method) {
        res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
        return res.sendStatus(200);
    }
    next();
});

app.get('/', (req, res) => {
  	res.send('Hello World!');
});

app.get('/api', (req, res) => {
	res.send('Hello from byapi!');
});

app.get('/telegram', (req, res) => {
	res.send('Hello from telegram api!');
});

app.use('/api', require('./api/router.js'));
app.use('/telegram', require('./telegram/telegram_router.js'));

app.listen(process.env.PORT, () => {
  	console.log(`Api working on port ${process.env.PORT}`)
});