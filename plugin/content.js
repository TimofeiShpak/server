console.log("Alice cinema mode:", location.href);

// ========= helpers =========

function findVideo(){
    return document.querySelector("video");
}

async function forcePlay(video){
    if(!video) return false;

    try{
        await video.play();
        console.log("play ok");
        return true;
    }catch(e){
        try{
            video.muted = true;
            await video.play();
            video.muted = false;
            console.log("muted autoplay ok");
            return true;
        }catch(err){
            console.log("play blocked");
        }
    }
    return false;
}

// ========= fullscreen =========

function enterFullscreen(video){

    const el = video || document.documentElement;

    if(document.fullscreenElement) return;

    if(el.requestFullscreen){
        el.requestFullscreen().catch(()=>{});
    }
}

// ========= клик в центр =========

function clickCenter(){
    const x = window.innerWidth/2;
    const y = window.innerHeight/2;

    const ev = new MouseEvent("click",{
        bubbles:true,
        cancelable:true,
        view:window,
        clientX:x,
        clientY:y
    });

    document.elementFromPoint(x,y)?.dispatchEvent(ev);
}

// ========= кино режим =========

async function startCinema(){

    console.log("cinema start");

    let video = findVideo();

    // если видео ещё грузится
    if(!video){
        console.log("waiting video...");

        const obs = new MutationObserver(()=>{
            const v = findVideo();
            if(v){
                obs.disconnect();
                runCinema(v);
            }
        });

        obs.observe(document.body,{childList:true,subtree:true});
        return;
    }

    runCinema(video);
}

async function runCinema(video){

    console.log("video found");

    // имитируем user gesture
    clickCenter();

    // play
    await forcePlay(video);

    // fullscreen через 0.8 сек
    setTimeout(()=>{
        enterFullscreen(video);
    },800);

    // ещё один play через 1.5 сек
    setTimeout(()=>{
        forcePlay(video);
    },1500);
}

// ========= поиск iframe =========

function findIframeUrl(){

    // если уже страница плеера — ничего не открываем
    if(location.href.includes("embed") ||
       location.href.includes("player") ||
       location.href.includes("video")){
        return null;
    }

    const iframe = document.querySelector("iframe");

    if(iframe?.src?.startsWith("http")){
        return iframe.src;
    }

    if(iframe?.dataset){
        for(const k in iframe.dataset){
            const v = iframe.dataset[k];
            if(v?.startsWith("http")) return v;
        }
    }

    return null;
}

// ========= listener =========

chrome.runtime.onMessage.addListener((req)=>{

    if(req.type !== "VIDEO_CONTROL") return;

    if(req.action === "play"){

        // если уже страница плеера → кино режим
        if(
            location.href.includes("embed") ||
            location.href.includes("player") ||
            location.href.includes("video")
        ){
            startCinema();
            return;
        }

        // если страница фильма → открыть iframe
        const url = findIframeUrl();

        if(url){
            chrome.runtime.sendMessage({
                action:"openIframe",
                url:url
            });
            return;
        }

        // обычное видео
        startCinema();
    }

    if(req.action === "pause"){
        const v = findVideo();
        if(v) v.pause();
    }
});
