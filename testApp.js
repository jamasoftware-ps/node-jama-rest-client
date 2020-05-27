const express = require('express');
const client = require('./jamaClient');
const app = express();
const port = 3000;

// todo: move this into a config file or env variable.
let credentials = {
    url: 'https://your-jama.jamacloud.com',
    username: 'username',   // or client id
    password: 'password',   // or client secret
    isBasic: true
};

// init the client with credentials
client.init(credentials)

// test endpoints
app.get('/', (request, response) => response.send('hello world'));

app.get('/check-connection', (request, response) => {
    client.checkConnection()
        .then(success => response.send(success))
        .catch(error => response.send(error))
});

app.get('/get-comments', (request, response) => {
    client.getAll('comments')
        .then(success => response.send(success))
        .catch(error => response.send(error))
});



app.listen(port, function(){
console.log(`Jama Client Test Driver app listening at http://localhost:${port}\n`);
console.log(`\ttest connection: http://localhost:${port}/check-connection`);
console.log(`\tget-comments: http://localhost:${port}/get-comments`);
});