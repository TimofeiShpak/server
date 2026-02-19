// content.js

console.log("🎬 content loaded:", location.href);

//
// ==================================================
// KEEPALIVE
// ==================================================
//

let keepPort=null;

function connectKeepAlive(){
    try{
        keepPort=chrome.runtime.connect({name:"keepalive"});
    }catch{
        setTimeout(connectKeepAlive,2000);
        return;
    }

    keepPort.onDisconnect.addListener(()=>{
        keepPort=null;
        setTimeout(connectKeepAlive,2000);
    });
}
connectKeepAlive();

setInterval(()=>{
    try{keepPort?.postMessage({ping:true});}catch{}
},20000);

//
// ==================================================
// UTILS
// ==================================================
//

const delay = ms => new Promise(r=>setTimeout(r,ms));

//
// ==================================================
// FIND MAIN IFRAME
// ==================================================
//

function findMainIframe(){

    const iframes=[...document.querySelectorAll("iframe")];
    if(!iframes.length) return null;

    let best=null;
    let bestArea=0;

    for(const iframe of iframes){

        const rect=iframe.getBoundingClientRect();
        const area=rect.width*rect.height;

        if(area<60000) continue;

        if(area>bestArea){
            bestArea=area;
            best=iframe;
        }
    }

    return best;
}

//
// ==================================================
// EXTRACT DATASET URL
// ==================================================
//

function extractDatasetUrl(iframe){

    if(!iframe?.dataset) return null;

    for(const key in iframe.dataset){
        const val=iframe.dataset[key];
        if(typeof val==="string" && val.startsWith("http")){
            return val;
        }
    }

    return null;
}

//
// ==================================================
// CINEMA MODE (только если iframe уже работает)
// ==================================================
//

function enableCinemaMode(iframe){

    if(!iframe) return false;

    console.log("cinema mode stretch");

    let el = iframe;

    // поднимаемся до body
    while(el && el !== document.body){

        el.style.position = "fixed";
        el.style.top = "0";
        el.style.left = "0";
        el.style.width = "100vw";
        el.style.height = "100vh";
        el.style.margin = "0";
        el.style.padding = "0";
        el.style.zIndex = "999999";

        el = el.parentElement;
    }

    // body отдельно
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.background = "black";
    document.body.style.overflow = "hidden";

    return true;
}

//
// ==================================================
// PLAY LOGIC
// ==================================================
//

async function startPlay(){

    console.log("startPlay");

    for(let i=0;i<15;i++){

        const iframe=findMainIframe();
        if(!iframe){
            await delay(1000);
            continue;
        }

        enableCinemaMode(iframe);
        console.log("iframe src found → using page");
    }

    console.log("iframe not found");
}

//
// ==================================================
// MESSAGE LISTENER
// ==================================================
//

chrome.runtime.onMessage.addListener((req)=>{

    if(!req || req.type!=="VIDEO_CONTROL") return;

    if(req.action==="play"){
        startPlay();
        return;
    }
});
