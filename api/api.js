require('dotenv/config');
const {Configuration, OpenAIApi} = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

module.exports.generateImage = async (text, callback) => {

    const response = await openai.createImage({
        prompt: text,
        n: 1,
        size: "256x256",
    });
    image_url = response.data.data[0].url;
    //console.log(image_url);
    callback(null, image_url);
};

module.exports.chat = async (text, status, type, callback) => {
    /**
     * status = 1 -> eş anlamlı
     * status = 2 -> zıt anlamlı
     * status = 3 -> yakın anlamlı, benzer
     * 
     * type = 1 -> Verilen kelime ile ilgili 10 keyword getir
     * type = 2 -> Verilen kelime ile 1 cümle açıklama getir
    */
    let statusTxt = '';
    if (status == 1) statusTxt = 'synonym for';
    else if (status == 2) statusTxt = 'opposite of';
    else if (status == 3) statusTxt = 'similar meaning for';

    // TODO: lang = 'TR';

    let query, startText = "Response must be in json format like {name: '', description: ''}.";
    if (type == 1) {
        query = "Response must be in array format. Give 8 example keywords about " + statusTxt + " " + text; //+ " with a brief explanation."
    } else {
        query = "Give 1 sentence explanation about " + statusTxt + " " + text;
    }
    
    const completion = await openai.createChatCompletion({
        /*
        model: "text-davinci-003",
        prompt: "say hi",
        temperature: 0.9,
        max_tokens: 150,
        top_p: 1,
        frequency_penalty: 0.0,
        presence_penalty: 0.6,
        stop: [" Human:", " AI:"],
        */
        model: "gpt-3.5-turbo",
        messages: [{role: "user", content: query}],
    });
    //console.log(completion.data.choices[0].message);
    callback(null, completion.data.choices[0].message);
};
