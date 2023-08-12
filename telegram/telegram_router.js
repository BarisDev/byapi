const express = require('express');
const router = express.Router();
const telegram = require('./telegram.js');

router.post('/saveNews', (req, res) => {
    if (!req.body.json) return res.status(400).json({
        code: 400,
        message: 'Parametre hatası.'
    }).end();

    telegram.saveNews(req.body.json, (err, data) => {
        if (err) return res.status(err.code).json({ code: err.code, message: err.message }).end();
        res.send(data);
    });
});


router.post('/getNews', (req, res) => {
    if (!req.body.time) return res.status(400).json({
        code: 400,
        message: 'Parametre hatası.'
    }).end();

    telegram.getNews(req.body.time, (err, data) => {
        if (err) return res.status(err.code).json({ code: err.code, message: err.message }).end();
        res.send(data);
    });
});

module.exports = router;