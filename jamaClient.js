const request = require('request');
const url = require('url');
const restPath = '/rest/v1/';
const maxResults = 50; // max is 50
let debug = true;
let client;

class JamaClient {
    constructor(credentials) {
        this.credentials = credentials
    }
}

function init(credentials) {
    client = new JamaClient(credentials)
}


function checkConnection() {
    if (debug) console.log('checking connection... credentials:', client.credentials);
    return new Promise(function (resolve, reject) {
        getSingle('').then(function (response) {
            if (response !== undefined && response.length > 0) {
                resolve('valid credentials');
            }
            else {
                reject('ERROR: ' + response);
            }
        }).catch(function (error) {
            reject('ERROR: ' + error);
        });

    });
}


function getSingle(endpoint) {
    return new Promise(function (resolve, reject) {
        let options = {
            method: 'GET',
            json: true
        };
        options = setOptionsUrl(options, endpoint);
        if (debug)  console.log('getting page... options:', options);
        request(options, function (err, res, body) {
            // lets make sure that everything checks out
            if (err) {
                reject(err.message);
            }
            else {
                resolve(body.data);
            }

        });
    });
}


function getAll(endpoint) {
    if (debug) console.log('getting all pages...', endpoint);
    return new Promise(function (resolve, reject) {
        setAccessToken(function (patchedCreds) {
            if (debug) console.log('patched creds,', patchedCreds)
            if (patchedCreds !== null) {
                client.credentials = patchedCreds;
                if (debug) console.log('getting credentials')
                getResultTotal(endpoint).then(total => {
                    if (debug) ('getting ', total);
                    // build out all the requests
                    let requestCount = Math.ceil(total / maxResults);
                    let requestArray = [];
                    let startAtIndex = 0;

                    for (let i=0; i < requestCount; i++) {
                        let request = getSinglePage(endpoint, startAtIndex);
                        requestArray.push(request);
                        startAtIndex += maxResults;
                    }

                    Promise.all(requestArray).then(results => {
                        results = [].concat.apply([], results); // flatten the list
                        resolve(results);
                    }).catch(error => {
                        if (debug) console.log('error:', error)
                        reject(error);
                    })

                });
            }
            else {
                reject(null);
            }
        });
    });
}


// posts an entry
function post(credentials, endpoint, payload) {
    return new Promise(function (resolve, reject) {
        let options = {
            method: 'POST',
            json: true,
            body: payload
        };

        options = setOptionsUrl(options, endpoint);
        request(options, function (err, res, body) {
            // lets make sure that everything checks out
            if (err) {
                reject(body.meta);
            }
            // we successfully posted?
            if (body.meta.status === 'Created') {
                resolve(body.meta.id);
            }
            else {
                reject(null);
            }
        });
    });
}

// updates an item with a PUT request
function put(credentials, endpoint, payload) {
    return new Promise(function (resolve, reject) {
        let options = {
            method: 'PUT',
            json: true,
            body: payload
        };
        options = setOptionsUrl(options, endpoint);
        request(options, function (err, res, body) {
            // lets make sure that everything checks out
            if (err) {
                reject(body.meta);
            }
            // we successfully posted?
            if (body.meta.status === 'OK') {
                resolve(body.meta.id);
            }
            else {
                reject(null);
            }
        });
    });
}

// updates an item with a PATCH request
function patch(credentials, endpoint, payload) {
    return new Promise(function (resolve, reject) {
        let options = {
            method: 'PATCH',
            json: true,
            body: payload
        };
        options = setOptionsUrl(options, endpoint);
        request(options, function (err, res, body) {
            // lets make sure that everything checks out
            if (err) {
                reject(body.meta);
            }
            // we successfully posted?
            if (body.meta.status === 'OK') {
                resolve(body.meta.id);
            }
            else {
                reject(null);
            }
        });
    });
}

function getSinglePage(endpoint, startIndex) {
    return new Promise(function (resolve, reject) {
        if (debug) console.log('getting single page...', endpoint);
        let options = {
            url: '',
            method: 'GET',
            json: true
        };
        options = setOptionsUrl(options, endpoint);
        options.url += '?startAt=' + startIndex + '&maxResults=' + maxResults;
        request(options, function (err, res, body) {
            // lets make sure that everything checks out
            if (err || body.meta.status !== 'OK') {
                reject(err);
            }
            // console.log(body.data)
            resolve(body.data)
        });
    });
}

function getAccessToken(credentials) {
    return new Promise(function (resolve, reject) {
        let options = {
            url: buildOauthUrl() + '/rest/oauth/token',
            method: 'POST',
            auth: {
                user: credentials.username,
                pass: credentials.password
            },
            form: {
                'grant_type': 'client_credentials'
            },
            json: true
        };
        request(options, function (err, res, body) {
            if (err) {
                reject(null);
            }
            resolve(body.access_token);
        });
    });
}

function getResultTotal(endpoint) {
    return new Promise(function (resolve, reject) {
        let options = {
            method: 'GET',
            json: true
        };
        options = setOptionsUrl(options, endpoint + '?maxResults=1');
        request(options, function (err, res, body) {
            // lets make sure that everything checks out
            if (err) {
                reject(err);
            }
            resolve(body.meta.pageInfo.totalResults);
        });
    });
}



function setAccessToken(callback) {
    if (debug) console.log('setting access token...')

    // we need to grab an access token if we are using oauth
    if (client.credentials.isBasic) {
        client.credentials.accessToken = null;
        return callback(client.credentials);
    }
    else {
        getAccessToken(client.credentials).then(function (accessToken) {
            client.credentials.accessToken = accessToken;
            return callback(client.credentials);
        }).catch(function () {
            return callback(null);
        });

    }
}

function setOptionsUrl(options, endpoint) {
    // we using basic auth?
    if (client.credentials.isBasic) {
        options.url = buildBasicAuthUrl() + restPath + endpoint;
    }
    // nope, okay lets use oauth then
    else {
        options.url = buildOauthUrl() + restPath + endpoint;
        options.headers = {'Authorization': 'Bearer ' + client.credentials.accessToken};
    }
    return options;
}


function buildBasicAuthUrl() {
    let urlObject = buildUrlObject(client.credentials.url);
    let urlString = urlObject.protocol;
    if (urlObject.slashes) {
        urlString += '//'
    }
    return urlString + client.credentials.username + ':' + client.credentials.password + '@' + urlObject.host;
}

function buildOauthUrl() {
    let urlObject = buildUrlObject(client.credentials.url);
    let urlString = urlObject.protocol;
    if (urlObject.slashes) {
        urlString += '//'
    }
    return urlString + urlObject.host;
}

function buildUrlObject(urlString) {
    // does NOT start with 'https://' OR 'http://', aka base url only
    if (urlString.indexOf('https://') === 0 || urlString.indexOf('http://') === 0) {
        return url.parse(urlString);
    }
    else {
        return url.parse('https://' + urlString);
    }
}


module.exports = {
    init: init,
    checkConnection: checkConnection,
    getAll: getAll,
    getSingle: getSingle,
    postEntry: post,
    putEntry: put
};

