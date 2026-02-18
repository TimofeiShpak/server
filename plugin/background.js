const PROXY_SERVER = 'wss://server-03cr.onrender.com';

let nativeWS = null;
let ws = null;
let reconnectAttempts = 0;
let manualClose = false;
let cinemaLaunched = false;

const maxReconnectAttempts = 10;
const reconnectDelay = 4000;

//
// ================= NATIVE BRIDGE =================
//

function connectNative(){

    if(nativeWS && nativeWS.readyState === 1) return;

    try{
        nativeWS = new WebSocket("ws://localhost:8765");

        nativeWS.onopen = ()=>{
            console.log("🟢 native bridge connected");
        };

        nativeWS.onclose = ()=>{
            console.log("🔴 native bridge disconnected");
            setTimeout(connectNative, 3000);
        };

        nativeWS.onerror = ()=>{
            console.log("native bridge error");
            setTimeout(connectNative, 3000);
        };

    }catch(e){
        setTimeout(connectNative, 3000);
    }
}

// отправка команд в node
function nativeClick(){
    if(nativeWS?.readyState === 1){
        nativeWS.send("click");
    }
}

function nativeFullscreen(){
    if(nativeWS?.readyState === 1){
        nativeWS.send("fullscreen");
    }
}

//
// ================= PROXY SOCKET =================
//

function connectToProxy() {
    try {
        console.log('Подключение к серверу...');
        manualClose = false;

        ws = new WebSocket(PROXY_SERVER);

        ws.onopen = () => {
            console.log('✓ Proxy подключен');
            reconnectAttempts = 0;
            updateExtensionStatus('connected', 'Подключено');
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (!message.text) return;

                const command = extractTextFromCommand(message.text);
                console.log('command', command);
                commandRun(command);

            } catch (e) {
                console.error('Ошибка обработки:', e);
            }
        };

        ws.onclose = () => {
            console.log('Proxy закрыт');
            if (!manualClose) handleReconnection();
        };

        ws.onerror = () => {
            console.log('Proxy error');
        };

    } catch {
        handleReconnection();
    }
}

function handleReconnection() {
    if (reconnectAttempts >= maxReconnectAttempts) {
        updateExtensionStatus('offline', 'Сервер недоступен');
        return;
    }

    reconnectAttempts++;
    const delay = reconnectDelay * reconnectAttempts;

    setTimeout(connectToProxy, delay);
}

//
// ================= STATUS =================
//

function updateExtensionStatus(status, message) {
    if(chrome.action?.setTitle){
        chrome.action.setTitle({ title: `Alice: ${message}` });
    }

    chrome.storage.local.set({
        extensionStatus: { status, message, time: Date.now() }
    });
}

//
// ================= COMMAND PARSER =================
//

function extractTextFromCommand(text) {
    let words = text.toLowerCase().split(" ");
    let i = 0;

    if (words[i] === 'алиса') i++;

    let type = 'search';
    const searchWords = ['найди','найти','поищи','ищи','поиск'];

    if (words[i] === 'включи') { type = 'switch'; i++; }
    else if (words[i] === 'закрой') { type = 'close'; i++; }
    else if (words[i] === 'открой') { type = 'open'; i++; }
    else if (searchWords.includes(words[i])) { i++; }

    return { type, text: words.slice(i).join(" ").trim() };
}

//
// ================= COMMAND RUN =================
//

function commandRun(command) {

    // ▶ play видео
    if (command.type === 'switch') {
        chrome.tabs.query({active:true,currentWindow:true}, (tabs)=>{
            if (!tabs.length) return;
            chrome.tabs.sendMessage(tabs[0].id,{
                type:"VIDEO_CONTROL",
                action:"play"
            }, ()=>{});
        });
    }

    // ▶ закрыть вкладки
    else if (command.type === 'close') {
        chrome.tabs.query({}, tabs=>{
            tabs.forEach(tab=>{
                if(tab.title?.toLowerCase().includes(command.text)){
                    chrome.tabs.remove(tab.id);
                }
            });
        });
    }

    // ▶ поиск
    else {
        const url = `https://yandex.ru/search?text=${encodeURIComponent(command.text)}`;
        openSearch(url);
    }
}

function openSearch(url){
    chrome.tabs.query({url:'https://yandex.ru/search*'}, tabs=>{
        if(tabs.length){
            chrome.tabs.update(tabs[0].id,{url,active:true});
        } else {
            chrome.tabs.create({url});
        }
    });
}

//
// ================= EXTENSION EVENTS =================
//

// старт chrome
chrome.runtime.onStartup.addListener(()=>{
    console.log("chrome started");
    connectNative();
    connectToProxy();
});

// установка
chrome.runtime.onInstalled.addListener(()=>{
    connectNative();
    connectToProxy();
});

// держим service worker живым
setInterval(()=>{
    connectNative();
}, 20000);

//
// ================= POPUP + IFRAME =================
//

chrome.runtime.onMessage.addListener((req, sender, sendResponse)=>{

    if(req.action === 'connect'){
        connectToProxy();
        sendResponse({ok:true});
    }

    else if(req.action === 'disconnect'){
        manualClose = true;
        if(ws) ws.close();
        ws = null;
        updateExtensionStatus('off','Отключено');
        sendResponse({ok:true});
    }

    else if(req.action === 'status'){
        sendResponse({ ws: ws ? ws.readyState : 3 });
    }

    // открытие iframe фильма
    else if(req.action === "openIframe"){

        if(cinemaLaunched) return;
        cinemaLaunched = true;

        chrome.tabs.create({ url: req.url, active:true }, (tab)=>{

            const tabId = tab.id;

            chrome.tabs.onUpdated.addListener(function listener(id, info){

                if(id === tabId && info.status === "complete"){
                    chrome.tabs.onUpdated.removeListener(listener);

                    setTimeout(()=> nativeClick(), 2500);
                    setTimeout(()=> nativeFullscreen(), 4500);

                    setTimeout(()=> cinemaLaunched = false, 15000);
                }
            });
        });
    }

    return true;
});

// первый запуск
connectNative();
setTimeout(connectToProxy, 1500);
