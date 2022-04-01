/**
 * Filesystem module for reading and writing to .json file
 */
const fs = require('fs');
const readline = require('readline-sync')
var colors = require('colors/safe');

console.log("Starting CS:GO GSI - ArtNet Application Initialization Process");

/**
 * Asks the user for host IP address and port number
 */
let HOST = readline.question(colors.green('First give the IP address where to start listening HTTP requests from (default: 127.0.0.1): '));
let PORT = readline.question(colors.green('Next give the port where to start listening the HTTP requests from (default: 3000): '));

createHostConfig();

/**
 * Creates host config file (host.json) according to user input. If either of user input was empty,
 * defaults to 127.0.0.1:3000.
 */
function createHostConfig() {
    if (HOST === "") {
        HOST = "127.0.0.1";
    }
    
    if (PORT === "") {
        PORT = 3000;
    }

    const hostObj = {
        ip: HOST,
        port: PORT
    }

    fs.writeFileSync("./host.json", JSON.stringify(hostObj));
    console.log(colors.green("Host settings configured."));
}

/**
 * Asks the user if the user is going to use the application in a headless system without a monitor. Web browser functionality
 * requires a monitor obviously.
 */
let headless = readline.question(colors.green('Are you going to be running the app in a headless system? (Answer: Y / N): '));

/**
 * If user has decided to go with headless, it creates a sample config.json file for artnet functions.
 * If user is not going headless, it won't create the config.json file, instead user will create it 
 * via web browser.
 */
if (headless == 'y') {
    let artnetObj = {
        ip: "192.168.10.1",
        port: "6454",
        universe: "1",
        playertoken: Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12),
        observertoken: Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12),
        testertoken: Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12)
    }

    fs.writeFile("./config.json", JSON.stringify(artnetObj, null, 2), (err) => {
        if (err) {
            console.error(err);
            return;
        };
        console.log(colors.green("Sample config.json file has been created."));
        console.log(colors.green("config.json holds settings for ArtNet signals and auth tokens."));
        console.log(colors.green("Configure config.json to your needs."));
    });

    console.log(colors.green("\nApplication initialized. Listening HTTP requests at: "+HOST+":"+PORT));
} else {
    console.log(colors.green("\nApplication initialized. Listening HTTP requests at: "+HOST+":"+PORT));
    console.log(colors.green("Please run \"npm start\" and go to http://"+HOST+":"+PORT+" via any web browser to configurate your application."));
}