const express = require('express');
const router = express.Router();
const API = require('./api.js');

router.post('/generateImage', (req, res) => {
    console.log(req.body)
    if (!req.body.text) return res.status(400).json({
        code: 400,
        message: 'Parametre hatası.'
    }).end();

    API.generateImage(req.body.text, (err, data) => {
        if (err) return res.status(err.code).json({ code: err.code, message: err.message }).end();
        res.send(data);
    });
});

router.post('/chat', (req, res) => {
    if (!req.body.text) return res.status(400).json({
        code: 400,
        message: 'Parametre hatası.'
    }).end();

    API.chat(req.body.text, req.body.status, req.body.type, (err, data) => {
        if (err) return res.status(err.code).json({ code: err.code, message: err.message }).end();
        res.send(data);
    });
});


module.exports = router;