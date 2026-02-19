// background.js

let bridge = null;
let reconnectTimer = null;
let searchOpening = false;

const BRIDGE_URL = "ws://localhost:3001";

//
// ================= CONNECT BRIDGE =================
//

function isAlive(){
    return bridge && bridge.readyState === WebSocket.OPEN;
}

function scheduleReconnect(){
    if(reconnectTimer) return;

    reconnectTimer = setTimeout(()=>{
        reconnectTimer = null;
        connectBridge();
    },3000);
}

function connectBridge(){

    if(bridge &&
       (bridge.readyState === WebSocket.OPEN ||
        bridge.readyState === WebSocket.CONNECTING)){
        return;
    }

    console.log("connecting bridge...");
    bridge = new WebSocket(BRIDGE_URL);

    bridge.onopen = ()=>{
        console.log("🟢 bridge connected");
    };

    bridge.onclose = ()=>{
        console.log("🔴 bridge closed");
        bridge = null;
        scheduleReconnect();
    };

    bridge.onerror = ()=>{
        try{ bridge.close(); }catch{}
    };

    bridge.onmessage = (event)=>{
        try{
            const msg = JSON.parse(event.data);
            handleCommand(msg);
        }catch{}
    };
}

connectBridge();
setInterval(()=>{ if(!isAlive()) connectBridge(); }, 25000);

chrome.runtime.onStartup.addListener(connectBridge);
chrome.runtime.onInstalled.addListener(connectBridge);

//
// ================= KEEP SERVICE WORKER ALIVE =================
// главный фикс против sleep
//

setInterval(()=>{
    chrome.runtime.getPlatformInfo(()=>{});
},20000);

//
// ================= KEEPALIVE PORT FROM CONTENT =================
// делает worker бессмертным пока есть вкладка
//

chrome.runtime.onConnect.addListener(port=>{
    if(port.name !== "keepalive") return;

    console.log("keepalive port connected");

    port.onMessage.addListener(()=>{});
    port.onDisconnect.addListener(()=>{
        console.log("keepalive port disconnected");
    });
});

//
// ================= SEND VIDEO =================
//

function sendVideoAction(action,text){

    chrome.tabs.query({active:true,currentWindow:true},tabs=>{
        if(!tabs.length) return;

        const tabId = tabs[0].id;

        const payload = {
            type:"VIDEO_CONTROL",
            action,
            text
        };

        try{ chrome.tabs.sendMessage(tabId,payload); }catch{}

        setTimeout(()=>{
            try{ chrome.tabs.sendMessage(tabId,payload); }catch{}
        },1200);
    });
}

//
// ================= COMMAND HANDLER =================
//

function handleCommand(msg){
    if(!msg || !msg.action) return;

    console.log("CMD:",msg);

    switch(msg.action){

        case "play":
            sendVideoAction("play");
            break;

        case "search":
            openSearch(msg.text);
            break;

        case "close":
            closeTabs(msg.text);
            break;

        case "closeActive":
            closeActiveTab();
            break;

        case "open":
            openLord();
            break;
    }
}

//
// ================= SEARCH =================
//

function openSearch(text){
    if(searchOpening || !text) return;
    searchOpening = true;

    const q = encodeURIComponent(text);

    chrome.tabs.query({url:"*://yandex.ru/search*"},tabs=>{

        const url = `https://yandex.ru/search?text=${q}`;

        if(tabs.length){
            chrome.tabs.update(tabs[0].id,{url,active:true},()=>searchOpening=false);
        }else{
            chrome.tabs.create({url,active:true},()=>searchOpening=false);
        }
    });

    setTimeout(()=> searchOpening=false,5000);
}

//
// ================= CLOSE =================
//

function closeTabs(text){
    if(!text) return;
    const t = text.toLowerCase();

    chrome.tabs.query({},tabs=>{
        tabs.forEach(tab=>{
            if(tab.title?.toLowerCase().includes(t)){
                chrome.tabs.remove(tab.id);
            }
        });
    });
}

function closeActiveTab(){

    chrome.tabs.query({active:true,currentWindow:true},tabs=>{
        if(!tabs.length) return;
        const tab = tabs[0];
        chrome.tabs.remove(tab.id);
    });
}

//
// ================= OPEN LORD =================
//

function openLord(){

    chrome.tabs.query({active:true,currentWindow:true}, async tabs=>{
        if(!tabs.length) return;

        const tab = tabs[0];
        if(!tab.url || tab.url.startsWith("chrome")) return;

        try{
            await chrome.scripting.executeScript({
                target:{tabId:tab.id},
                func:()=>{
                    const link=document.querySelector('a[href*="lordfilm"]');
                    if(link) location.href=link.href;
                }
            });
        }catch{}
    });
}

//
// ================= FROM CONTENT =================
//

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{

    if(msg.action==="openIframe"){
        chrome.tabs.create({
            url:msg.url,
            active:true
        });
        return;
    }

    if(msg.action==="status"){
        sendResponse({connected:isAlive()});
        return true;
    }

    if(msg.action==="ping"){
        sendResponse({ok:true});
        return true;
    }
});
