// content.js

console.log("🎬 content loaded:", location.href);

//
// ==================================================
// KEEPALIVE PORT (AUTO RECONNECT, BFCache SAFE)
// ==================================================
//

let keepPort = null;

function connectKeepAlive(){

    try{
        keepPort = chrome.runtime.connect({ name: "keepalive" });
    }catch{
        setTimeout(connectKeepAlive, 2000);
        return;
    }

    keepPort.onDisconnect.addListener(()=>{
        console.log("keepalive disconnected → reconnect");
        keepPort = null;
        setTimeout(connectKeepAlive, 2000);
    });
}

connectKeepAlive();

setInterval(()=>{
    try{
        keepPort?.postMessage({ ping:true });
    }catch{}
}, 20000);

//
// ==================================================
// STATE FLAGS
// ==================================================
//

let iframeOpening = false;
let iframeOpenedOnce = false;
let playRunning = false;

const delay = ms => new Promise(r => setTimeout(r, ms));

//
// ==================================================
// FIND MAIN VIDEO
// ==================================================
//

function findMainVideo(){

    const videos = [...document.querySelectorAll("video")];
    if(!videos.length) return null;

    return videos.sort((a,b)=>
        (b.clientWidth*b.clientHeight) -
        (a.clientWidth*a.clientHeight)
    )[0];
}

async function safePlay(video){

    if(!video) return false;

    try{
        await video.play();
        return true;
    }catch{
        try{
            video.muted = true;
            await video.play();
            video.muted = false;
            return true;
        }catch{}
    }

    return false;
}

//
// ==================================================
// FIND MAIN IFRAME (BIGGEST ONLY)
// ==================================================
//

function findIframeUrl(){

    const iframes = [...document.querySelectorAll("iframe")];
    if(!iframes.length) return null;

    const candidates = [];

    for(const iframe of iframes){

        let url = null;

        if(iframe.src && iframe.src.startsWith("http")){
            url = iframe.src;
        }

        if(!url && iframe.dataset){
            for(const key in iframe.dataset){
                const val = iframe.dataset[key];
                if(typeof val === "string" && val.startsWith("http")){
                    url = val;
                    break;
                }
            }
        }

        if(!url) continue;

        const rect = iframe.getBoundingClientRect();
        const area = rect.width * rect.height;

        // игнорим рекламу и мелкие iframe
        if(area < 50000) continue;

        candidates.push({ url, area });
    }

    if(!candidates.length) return null;

    candidates.sort((a,b)=> b.area - a.area);

    return candidates[0].url;
}

//
// ==================================================
// PLAY SEQUENCE
// ==================================================
//

async function startPlay(){

    if(playRunning) return;
    playRunning = true;

    for(let i=0;i<10;i++){

        const video = findMainVideo();

        if(video){
            const ok = await safePlay(video);
            if(ok){
                playRunning = false;
                return;
            }
        }

        if(!iframeOpening && !iframeOpenedOnce){

            const iframeUrl = findIframeUrl();

            if(iframeUrl){
                iframeOpening = true;
                iframeOpenedOnce = true;

                console.log("opening iframe:", iframeUrl);

                chrome.runtime.sendMessage({
                    action:"openIframe",
                    url: iframeUrl
                });

                setTimeout(()=>{
                    iframeOpening = false;
                },5000);
            }
        }

        await delay(1200);
    }

    playRunning = false;
}

//
// ==================================================
// CONTROLS
// ==================================================
//

function pauseVideo(){
    const video = findMainVideo();
    if(video) video.pause();
}

async function resumeVideo(){
    const video = findMainVideo();
    if(video){
        await safePlay(video);
    }else{
        startPlay();
    }
}

//
// ==================================================
// MESSAGE LISTENER
// ==================================================
//

chrome.runtime.onMessage.addListener((req)=>{

    if(!req || req.type !== "VIDEO_CONTROL") return;

    if(req.action === "play") startPlay();
    if(req.action === "pause") pauseVideo();
    if(req.action === "resume") resumeVideo();
});
