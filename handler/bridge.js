// bridge.js

const WebSocket = require("ws");
const psList = require("ps-list").default;
const { exec } = require("child_process");
const { mouse, Button, Point, screen } = require("@nut-tree-fork/nut-js");
const loudness = require("loudness");
const os = require("os");

const REMOTE_SERVER = "wss://server-03cr.onrender.com";
const LOCAL_PORT = 3001;

let extensionWS = null;
let proxyWS = null;

let heartbeatInterval = null;
let keepAliveInterval = null;
let reconnectTimer = null;

//
// ======================
// UTILS
// ======================
//

const delay = ms => new Promise(r => setTimeout(r, ms));

function log(...a){
    console.log("[bridge]", ...a);
}

//
// ======================
// CHROME START
// ======================
//

async function ensureChromeRunning(){

    try{
        const list = await psList();
        const chrome = list.find(p =>
            p.name.toLowerCase().includes("chrome")
        );

        if(chrome){
            log("chrome running");
            return;
        }

        log("starting chrome...");

        if(os.platform() === "win32"){
            exec(`start "" chrome`);
        }else if(os.platform() === "darwin"){
            exec(`open -a "Google Chrome"`);
        }else{
            exec(`google-chrome`);
        }

        await delay(4000);

    }catch(e){
        log("chrome check error", e);
    }
}

//
// ======================
// WAIT EXTENSION
// ======================
//

async function waitExtension(){

    for(let i=0;i<40;i++){
        if(extensionWS && extensionWS.readyState === 1){
            return true;
        }
        await delay(500);
    }

    log("extension not connected");
    return false;
}

//
// ======================
// LOCAL WS SERVER
// ======================
//

const wss = new WebSocket.Server({ port: LOCAL_PORT });
log("local bridge started");

wss.on("connection", ws=>{

    log("extension connected");

    if(extensionWS && extensionWS.readyState === 1){
        try{ extensionWS.close(); }catch{}
    }

    extensionWS = ws;

    ws.on("close", ()=>{
        if(extensionWS === ws){
            extensionWS = null;
        }
        log("extension disconnected");
    });

    ws.on("error", ()=>{});
});

async function sendToExtension(obj){

    for(let i=0;i<12;i++){

        if(extensionWS && extensionWS.readyState === 1){
            try{
                extensionWS.send(JSON.stringify(obj));
                return true;
            }catch{}
        }

        await delay(400);
    }

    log("send fail (extension offline)");
    return false;
}

//
// ======================
// PROXY CONNECT
// ======================
//

function clearIntervals(){
    if(heartbeatInterval){
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if(keepAliveInterval){
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

function scheduleReconnect(){
    if(reconnectTimer) return;

    reconnectTimer = setTimeout(()=>{
        reconnectTimer = null;
        connectProxy();
    }, 4000);
}

function connectProxy(){

    if(proxyWS &&
       (proxyWS.readyState === 1 ||
        proxyWS.readyState === 0)){
        return;
    }

    log("connecting proxy...");

    try{
        proxyWS = new WebSocket(REMOTE_SERVER);
    }catch(e){
        scheduleReconnect();
        return;
    }

    proxyWS.on("open", ()=>{
        log("✓ proxy connected");

        clearIntervals();

        heartbeatInterval = setInterval(()=>{
            if(proxyWS?.readyState === 1){
                try{ proxyWS.ping(); }catch{}
            }
        },25000);

        keepAliveInterval = setInterval(()=>{
            if(proxyWS?.readyState === 1){
                try{
                    proxyWS.send(JSON.stringify({type:"keepalive"}));
                }catch{}
            }
        },600000);
    });

    proxyWS.on("message", async data=>{
        try{
            const msg = JSON.parse(data.toString());
            if(!msg?.text || typeof msg.text !== "string") return;

            log("voice:", msg.text);
            await handleCommand(msg.text);

        }catch(e){
            log("parse error", e);
        }
    });

    proxyWS.on("close", ()=>{
        log("proxy closed");
        clearIntervals();
        proxyWS = null;
        scheduleReconnect();
    });

    proxyWS.on("error", ()=>{
        log("proxy error");
        try{ proxyWS.close(); }catch{}
    });
}

connectProxy();

//
// ======================
// COMMANDS
// ======================
//

async function handleCommand(text){

    text = text.toLowerCase()
        .replace("алиса","")
        .replace(/[.,!]/g,"")
        .trim();

    if(!text) return;

    const words = text.split(" ");
    const action = words[0];
    const payload = words.slice(1).join(" ");

    await ensureChromeRunning();
    await waitExtension();

    //
    // =====================================================
    // ▶ SMART PLAY (включи фильм марвел)
    // =====================================================
    //
    if(action === "включи" && payload){

        console.log("SMART PLAY:", payload);

        // поиск
        await sendToExtension({
            action:"search",
            text: `${payload} смотреть онлайн бесплатно lord`
        });

        await delay(3500);

        // открыть страницу фильма
        await sendToExtension({
            action:"open",
            text: payload
        });

        await delay(6000);

        // запуск видео
        await playAndFullscreen();
        return;
    }

    //
    // ▶ PLAY (просто "включи")
    //
    if(action === "включи"){
        await playAndFullscreen();
        return;
    }

    //
    // ▶ OPEN
    //
    if(action === "открой"){
        await sendToExtension({action:"open", text: payload});
        return;
    }

    //
    // ▶ SEARCH
    //
    if(action === "найди" || action === "поиск"){
        await sendToExtension({action:"search", text: payload});
        return;
    }

    //
    // ▶ CLOSE
    //
    if(action === "закрой"){

        if(!payload){
            await sendToExtension({action:"closeActive"});
        }else{
            await sendToExtension({action:"close", text: payload});
        }

        return;
    }

    //
    // ▶ PAUSE
    //
    if(action === "пауза"){
        await sendToExtension({action:"pause"});
        return;
    }

    //
    // ▶ RESUME
    //
    if(action === "продолжи"){
        await sendToExtension({action:"resume"});
        return;
    }

    //
    // ▶ VOLUME
    //
    if(action === "громкость"){

        const volumes = {
            'ноль':0,'один':1,'два':2,'три':3,'четыре':4,'пять':5,
            'шесть':6,'семь':7,'восемь':8,'девять':9,'десять':10
        };

        const num = volumes[payload];

        if(num !== undefined){
            await loudness.setVolume(num * 10);
            console.log("volume:", num*10);
        }

        return;
    }
}

//
// =====================================================
// ОБЩАЯ ФУНКЦИЯ PLAY + FULLSCREEN
// =====================================================
//

async function playAndFullscreen(){

    console.log("PLAY");

    await sendToExtension({action:"play"});
    await delay(4000);

    try{
        const width = await screen.width();
        const height = await screen.height();

        const x = Math.floor(width/2);
        const y = Math.floor(height*0.28);

        await mouse.move(new Point(x,y));
        await delay(250);

        await mouse.click(Button.LEFT);
        await delay(800);

        await mouse.click(Button.LEFT);
        await mouse.click(Button.LEFT);

        console.log("fullscreen ok");

    }catch(e){
        console.log("mouse error", e);
    }
}

