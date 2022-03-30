/**
 * Basic express configuration
 */
const express = require('express');
const app = express();
const router = express.Router();

/**
 * Configuration for receiving requests
 */
let HOST = "";
let PORT = "";

/**
 * Filesystem module for reading and writing to .json file
 */
const fs = require('fs');

/**
 * Config file path
 */
const configPath = './config.json';

/**
 * Host configuration file path
 */
const hostPath = './host.json';

/**
 * Extracts the entire body portion of an incoming request and
 * exposes it on req.body
 */
const bodyParser = require('body-parser')

/**
 * JSON Object (which will be parsed from the config.json file)
 */
let config = {};

/**
 * JSON Object (which will be parsed from the host.json file)
 */
let hostSettings = {};

/**
 * IP-address and port where the ArtNet signals are sent.
 */
let options = {
    host: "",
    port: ""
}

/**
 * Universe where the ArtNet signal is sent.
 */
let UNIVERSE = "";

/**
 * Auth tokens for player, observer and artnet tester.
 */
let authTokenPlayer = "";
let authTokenObserver = "";
let authTokenArtnet = "";

let artnet = require('artnet')(options);

// Bomb timer in the CS:GO server, needs to be modified manually
const bombTimer = 40;

// setTimeOut function for launching bomb explosion cue via ArtNet
let bombTimeout;

let sideAtLeft = "";

/**
 * Checks if host.json and config.json files exist.
 *
 * host.json file has configuration for the server itself. It holds
 * IP address and port where to start listening requests from.
 *
 * config.json file has configuration for ArtNet signal and auth tokens.
 *
 * If host.json file does not exist, the App tells the user to run
 * "npm run init" first, where the host.json file will be made, and the
 * server won't launch.
 */
function checkExistingFiles() {
    var hostFound = false;

    try {
        if (fs.existsSync(hostPath)) {
            hostSettings = JSON.parse(fs.readFileSync('host.json', 'utf8'));
            HOST = hostSettings.ip;
            PORT = hostSettings.port;
            hostFound = true;
        }
    } catch (err) {
        console.error(err);
    }

    try {
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
            UNIVERSE = config.universe;
            options = {
                host: config.ip,
                port: config.port
            }
            authTokenPlayer = config.playertoken;
            authTokenObserver = config.observertoken;
            authTokenArtnet = config.testertoken;
        }
      } catch(err) {
        console.error(err)
    }

    return hostFound;
}

/**
 * Used to serve the index.html file from the "public" directory"
 */
router.use(express.static('public'));

/**
 * Configure the router handler to use bodyParser to parse the req.body
 */
router.use(bodyParser.urlencoded({ extended: true}));
router.use(bodyParser.json());

/**
 * Send the index.html from the public folder to the browser when requested
 */
router.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

router.get('/settings', (req, res) => {
    res.setHeader("Content-Type", "application/json");

    try {
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
            UNIVERSE = config.universe;
            options = {
                host: config.ip,
                port: config.port
            }
            authTokenPlayer = config.playertoken;
            authTokenObserver = config.observertoken;
            authTokenArtnet = config.testertoken;
        }
      } catch(err) {
        console.error(err)
    }

    res.json(config);
})

/**
 * Handles the POST requests from the button clicks. When a button click
 * and the request has been received, it first validates the request
 * (with an auth key), and then sends an artnet signal to the channel that
 * was given in the request body (depending on the button).
 */
router.post('/clicked', (req, res) => {
    const AUTH = req.body.auth;
    const CHANNEL = req.body.channel;


    if (AUTH === authTokenArtnet) {
        res.writeHead(200, { "Content-Type": "text/html" });


        console.log('ArtNet sent');
        console.log('Uni: '+UNIVERSE);
        console.log('Chan: '+CHANNEL);

        artnet.set(UNIVERSE, CHANNEL, 255, function (err, res) {
          artnet.set(UNIVERSE, CHANNEL, 0, function (err, res) {
          });
        });

        res.end('ok');
    } else {
        res.writeHead(401, { "Content-Type": "text/html" });
        res.end('authfail');
    }
});

/**
 * Handles the POST request from the form submit. Pushes everything
 * in the request to an object and writes the object to a .json file.
 */
router.post('/config', (req, res) => {
    res.writeHead(200, { "Content-Type": "text/html"});

    let config = {
        ip: req.body.ipaddress,
        port: req.body.port,
        universe: req.body.universe,
        playertoken: req.body.playertoken,
        observertoken: req.body.observertoken,
        testertoken: req.body.testertoken
    }

    fs.writeFile("./config.json", JSON.stringify(config, null, 2), (err) => {
        if (err) {
            console.error(err);
            return;
        };
        console.log("File has been created");
    });

    res.end('ok');
})

/**
 * Is the round over or not? Used to avoid duplicate method calls.
 */
let roundOver = true;

/**
 * Has the ace been already called or not? Used to avoid duplicate method calls.
 */
let aceCalled = false;

/**
 * Are we on freeze time?
 */
let onFreezeTime = true;

app.post('/csgo', function(req, res, next) {

    res.writeHead(200, { 'Content-Type': 'text/html' });

    let body = '';

    req.on('data', (data) => {
        body += data;
    });

    req.on('end', () => {
        let eventInfo = processGameEvents(JSON.parse(body));
        if (eventInfo !== '') {
            console.log(eventInfo);
        }

        res.end('');
    });

    next();
});

/**
 * Processes payloads to parse game events
 *
 * @param {object} data - Payload as JSON object
 * @return {string} - The string and the date and time of the game event if a desired game event was detected
 */
function processGameEvents(gsidata) {
    // Ignore unauthenticated payloads
    // if (!isAuthentic(data)) {
    //     return '';
    // }


    const data = gsidata;
    const firstseat = null;

    let date = '';

    try {
        date = new Date(data.provider.timestamp * 1000);
    } catch (exception) {
        date = new Date();
    }

    let output = '';

    if (!roundOver) {
        output += detectGameEvent(data);
    } else if (!onFreezeTime) {
        output += detectFreezeTime(data);
    } else {
        output += detectGoingLive(data, firstseat);
    }

    if (output.length > 0) {
        output = `[${date.getFullYear()}-` +
            `${(date.getMonth() + 1)}-` +
            `${date.getDate()} ` +
            `${date.getHours()}:` +
            `${('00' + date.getMinutes()).substr(-2)}] ` +
            output;
    }

    return output;
}

// function checkSide(firstseat, data) {
//     const firstPlayer = readProperty(firstseat, 'Name');
//     const players = data.allplayers;

//     let output = '';

//     try {
//         Object.keys(players).forEach(function(key) {
//             const player = players[key];
//             if (player.name === firstPlayer) {
//                 if (sideAtLeft !== player.team) {
//                     sideAtLeft = player.team;
//                     console.log(player.team);
//                     if (player.team === 'CT') {
//                         output += firstSideCT();
//                     } else if (player.team === 'T') {
//                         output += firstSideT();
//                     }
//                 }
//             }
//         });
//     } catch (err) {
//         console.log(err);
//     }

//     return ", "+output;
// }

/**
 * Checks that the auth token from the CS:GO observer or player matches the one defined in this software.
 *
 * @param {object} data - The payload from CS:GO observer as a JSON object
 * @return {boolean}
 */
// function isAuthentic(data) {
//     let authenticated = false;
//     if (readProperty(data, 'auth.token') === authTokenPlayer || readProperty(data, 'auth.token') === authTokenObserver) {
//         authenticated = true;
//     }
//     return authenticated;
// }

/**
 * Called if round is over. Checks when the round starts and returns indication of that.
 *
 * @param {Object} data - The payload from CS:GO observer as a JSON object
 * @return {String} - Indication of going live when going live.
 */
function detectGoingLive(data, firstseat) {
    let output ='';

    if (readProperty(data, 'round.phase') === "live") {
        roundOver = false;
        aceCalled = false;
        onFreezeTime = false;
        output = goLive(data);
    }

    return output;
}

function detectFreezeTime(data) {
    let output = '';

    if (readProperty(data, 'round.phase') === "freezetime") {
        onFreezeTime = true;
        output = freezeTime(data);
    }

    return output;
}

/**
 * Checks if any of the events we're interested about happened.
 *
 * @param {object} data - The payload from CS:GO observer as a JSON object
 */
function detectGameEvent(data) {
    let output = '';

    if (readProperty(data, 'map.phase') === "gameover") {
        if (readProperty(data, 'map.team_ct.score') !== readProperty(data, 'map.team_t.score')) {
	        output += gameOver();
            roundOver = true;
	    }
    } else if (readProperty(data, 'round.phase') === "over") {
        clearTimeout(bombTimeout);
        output += checkWinningTeam(data);
        roundOver = true;
    } else {
        if (readProperty(data, 'added.round.bomb')) {
            output += bombPlanted();
        }
        // if (monitorPlayers(readProperty(data, 'allplayers'))) {
        //     output += ace();
        // }
    }

    return output;
}

/**
 * Checks which team won the round and checks if either bomb defusal or explosion happened as well.
 *
 * @param {String} winningTeam - The team which won.
 */
function checkWinningTeam(data) {
    let output = "";
    if (readProperty(data, 'round.win_team') === 'CT') {
        output += CTWin();

        if (readProperty(data, 'round.bomb') === "defused") {
            output += ", "+bombDefused();
        }
    } else {
        if (readProperty(data, 'round.bomb') !== "exploded") {
	        output += TWin();
        }
    }
    return output;
}

/**
 * Sends an artnet signal to channel one of the defined universe when bomb was planted.
 *
 * @return {String} - indication to console that bomb plant was detected.
 */
function bombPlanted() {
    bombTimeout = setTimeout(() => {
        console.log(new Date() + " " + bombExploded());
    }, (bombTimer * 1000));

    return "Bomb planted";
}

/**
 * Sends an artnet signal to channel two of the defined universe when bomb was defused.
 *
 * @return {String} - indication to console that bomb defusal was detected.
 */
function bombDefused() {

    clearTimeout(bombTimeout);

    artnet.set(UNIVERSE, 2, 255, function (err, res) {
    });
    setTimeout(function () {
      artnet.set(UNIVERSE, 2, 0, function (err, res) {
      });
    }, 3000);

    return "Bomb defused";
}

/**
 * Sends an artnet signal to channel three of the defined universe when bomb was defused.
 *
 * @return {String} - indication to console that bomb explosion was detected.
 */
function bombExploded() {

    artnet.set(UNIVERSE, 3, 255, function (err, res) {
    });
    setTimeout(function () {
      artnet.set(UNIVERSE, 3, 0, function (err, res) {
      });
    }, 3000);

    return "Bomb exploded";
}

/**
 * Sends an artnet signal to channel four of the defined universe when Counter-Terrorists win.
 *
 * @return {String} - indication to console that CTs victory was detected.
 */
function CTWin() {

    artnet.set(UNIVERSE, 4, 255, function (err, res) {
    });
    setTimeout(function () {
      artnet.set(UNIVERSE, 4, 0, function (err, res) {
      });
    }, 3000);

    return "CTs win";
}

/**
 * Sends an artnet signal to channel five of the defined universe when Terrorists win.
 *
 * @return {String} - indication to console that Ts victory was detected.
 */
function TWin() {

    artnet.set(UNIVERSE, 5, 255, function (err, res) {
    });
    setTimeout(function () {
      artnet.set(UNIVERSE, 5, 0, function (err, res) {
      });
    }, 3000);

    return "Ts win";
}

function freezeTime() {

    artnet.set(UNIVERSE, 6, 255, function (err, res) {
    });
    artnet.set(UNIVERSE, 7, 0, function (err, res) {
    });

    return "Freeze time!";
}

function goLive() {

    artnet.set(UNIVERSE, 6, 0, function (err, res) {
    });
    artnet.set(UNIVERSE, 8, 0, function (err, res) {
    });
    artnet.set(UNIVERSE, 7, 255, function (err, res) {
    });

    return "Going live!";
}

function gameOver() {

    artnet.set(UNIVERSE, 6, 0, function (err, res) {
    });
    artnet.set(UNIVERSE, 8, 0, function (err, res) {
    });
    artnet.set(UNIVERSE, 7, 0, function (err, res) {
    });
    artnet.set(UNIVERSE, 8, 255, function (err, res) {

    });

    return "Game over";
}

function firstSideCT() {

    artnet.set(UNIVERSE, 10, 255, function (err, res) {
      artnet.set(UNIVERSE, 10, 0, function (err, res) {

      });
    });

    return "Changing first side to CT";
}

function firstSideT() {
    let artnet = require ('artnet')(options);

    artnet.set(UNIVERSE, 11, 255, function (err, res) {
      artnet.set(UNIVERSE, 11, 0, function (err, res) {

      });
    });

    return "Changing first side to T";
}

/**
 * Helper function to read values under nested paths from objects
 *
 * @param {object} container - Object container
 * @param {string} propertyPath - Path to the property in the container
 *                                separated by dots, e.g. 'map.phase'
 * @return {mixed} - Null if the object has no requested property, property value
 *                 otherwise
 */
function readProperty(container, propertyPath) {
    let value = null;
    const properties = propertyPath.split('.');

    for (const p of properties) {
        if (!container.hasOwnProperty(p)) {
            return null;
        }

        value = container[p];
        container = container[p];
    }

    return value;
}

app.use('/', router);

if (checkExistingFiles()) {
    app.listen(PORT, HOST);
    console.log('Listening at '+HOST+":"+PORT);
} else {
    console.error("Please run \"npm run setup\"");
}
