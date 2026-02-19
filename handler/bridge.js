const WebSocket = require("ws");
const psList = require("ps-list").default;
const { exec } = require("child_process");
const loudness = require("loudness");
const os = require("os");

const { mouse, Button, Point, screen } = require("@nut-tree-fork/nut-js");

const REMOTE_SERVER = "wss://server-03cr.onrender.com";
const LOCAL_PORT = 3001;

let extensionWS = null;
let proxyWS = null;
let heartbeatInterval = null;
let keepAliveInterval = null;
let reconnectTimer = null;

const delay = ms => new Promise(r=>setTimeout(r,ms));

//
// ======================================================
// UTILS
// ======================================================
//

async function getPlayerPoint(isCenter){
    const width = await screen.width();
    const height = await screen.height();
    let heightPoint = isCenter ? height/2 : height*0.35;
    return new Point(
        Math.floor(width/2),
        Math.floor(heightPoint) // safe zone
    );
}

async function click(point, pause=250){
    await mouse.move(point);
    await delay(pause);
    await mouse.click(Button.LEFT);
}

//
// ======================================================
// CHROME START
// ======================================================
//

async function ensureChromeRunning(){

    try{
        const list = await psList();
        const chrome = list.find(p=>p.name.toLowerCase().includes("chrome"));
        if(chrome) return;

        console.log("starting chrome...");

        if(os.platform()==="win32"){
            exec(`start "" chrome`);
        }else if(os.platform()==="darwin"){
            exec(`open -a "Google Chrome"`);
        }else{
            exec(`google-chrome`);
        }

        await delay(4000);
    }catch(e){
        console.log("chrome error",e);
    }
}

//
// ======================================================
// WAIT EXTENSION
// ======================================================
//

async function waitExtension(){
    for(let i=0;i<40;i++){
        if(extensionWS && extensionWS.readyState===1) return true;
        await delay(500);
    }
    console.log("extension not connected");
    return false;
}

//
// ======================================================
// LOCAL WS SERVER
// ======================================================
//

const wss = new WebSocket.Server({port:LOCAL_PORT});
console.log("local bridge started");

wss.on("connection", ws=>{

    console.log("extension connected");

    if(extensionWS && extensionWS.readyState===1){
        try{extensionWS.close();}catch{}
    }

    extensionWS = ws;

    ws.on("close",()=>{
        if(extensionWS===ws) extensionWS=null;
        console.log("extension disconnected");
    });
});

async function sendToExtension(obj){

    for(let i=0;i<10;i++){

        if(extensionWS && extensionWS.readyState===1){
            try{
                extensionWS.send(JSON.stringify(obj));
                return true;
            }catch{}
        }

        await delay(400);
    }

    console.log("send fail", obj);
    return false;
}

//
// ======================================================
// PROXY CONNECT
// ======================================================
//

function clearIntervals(){
    if(heartbeatInterval) clearInterval(heartbeatInterval);
    if(keepAliveInterval) clearInterval(keepAliveInterval);
}

function scheduleReconnect(){
    if(reconnectTimer) return;

    reconnectTimer=setTimeout(()=>{
        reconnectTimer=null;
        connectProxy();
    },4000);
}

function connectProxy(){

    if(proxyWS &&
       (proxyWS.readyState===1 || proxyWS.readyState===0)){
        return;
    }

    if(proxyWS){
        try{proxyWS.terminate();}catch{}
        proxyWS=null;
    }

    console.log("connecting proxy...");
    proxyWS = new WebSocket(REMOTE_SERVER);

    proxyWS.on("open",()=>{
        console.log("✓ proxy connected");

        clearIntervals();

        heartbeatInterval=setInterval(()=>{
            if(proxyWS?.readyState===1){
                try{proxyWS.ping();}catch{}
            }
        },25000);

        keepAliveInterval=setInterval(()=>{
            if(proxyWS?.readyState===1){
                try{
                    proxyWS.send(JSON.stringify({type:"keepalive"}));
                }catch{}
            }
        },600000);
    });

    proxyWS.on("message",async data=>{
        try{
            const msg=JSON.parse(data.toString());
            if(!msg?.text) return;
            await handleCommand(msg.text);
        }catch(e){
            console.log("parse error",e);
        }
    });

    proxyWS.on("close",()=>{
        console.log("proxy closed");
        clearIntervals();
        proxyWS=null;
        scheduleReconnect();
    });

    proxyWS.on("error",()=>{
        console.log("proxy error");
        try{proxyWS.close();}catch{}
    });
}

connectProxy();

//
// ======================================================
// PLAYER CONTROL
// ======================================================
//

async function clickPlayer(){
    try{
        const movePoint = await getPlayerPoint();
        await mouse.move(movePoint);
        const clickPoint = await getPlayerPoint(true);
        await click(clickPoint);
    }catch(e){
        console.log("mouse error",e);
    }
}

async function playAndFullscreen(){

    await sendToExtension({action:"play"});
    await delay(2000);

    try{
        const p = await getPlayerPoint();

        // запуск
        await click(p,300);
        await delay(1500);

        // fullscreen dblclick
        await click(p,200);
        await click(p,200);

        console.log("fullscreen ok");

    }catch(e){
        console.log("mouse error",e);
    }
}

//
// ======================================================
// COMMAND HANDLER
// ======================================================
//

async function handleCommand(text){

    text = text.toLowerCase()
        .replace("алиса","")
        .replace(/[.,!]/g,"")
        .trim();

    if(!text) return;

    const words=text.split(" ");
    const action=words[0];
    const payload=words.slice(1).join(" ");

    await ensureChromeRunning();
    await waitExtension();
    await delay(500);

    //
    // ▶ SMART PLAY
    //
    if(action==="включи" && payload){

        console.log("SMART PLAY:",payload);

        // поиск
        await sendToExtension({
            action:"search",
            text:`${payload} смотреть бесплатно lord`
        });

        await delay(2000);

        // открыть страницу фильма
        await sendToExtension({
            action:"open",
            text:payload
        });

        console.log("waiting film page...");

        // ВАЖНО: ждём загрузки новой вкладки
        await delay(6000);

        // теперь play пойдёт уже в новую вкладку
        await playAndFullscreen();
        return;
    }

    //
    // ▶ PLAY
    //
    if(action==="включи"){
        await playAndFullscreen();
        return;
    }

    //
    // ▶ PAUSE / RESUME
    //
    if(action==="пауза" || action==="продолжи" || action==="продолжить"){
        await clickPlayer();
        return;
    }

    //
    // ▶ SEARCH
    //
    if(action==="найди" || action==="поиск"){
        await sendToExtension({action:"search",text:payload});
        return;
    }

    //
    // ▶ OPEN
    //
    if(action==="открой"){
        await sendToExtension({action:"open",text:payload});
        return;
    }

    //
    // ▶ CLOSE
    //
    if(action==="закрой"){

        if(!payload){
            await sendToExtension({action:"closeActive"});
        }else{
            await sendToExtension({action:"close",text:payload});
        }
        return;
    }

    //
    // ▶ VOLUME
    //
    if(action==="громкость"){

        const volumes={
            'ноль':0,'один':1,'два':2,'три':3,'четыре':4,'пять':5,
            'шесть':6,'семь':7,'восемь':8,'девять':9,'десять':10
        };

        const num=volumes[payload];

        if(num!==undefined){
            await loudness.setVolume(num*10);
            console.log("volume:",num*10);
        }
    }
}
