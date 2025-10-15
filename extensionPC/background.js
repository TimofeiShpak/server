const PROXY_SERVER = 'ws://localhost:8080';

let ws = null;
let pingInterval = null;

function connectToProxy() {
    try {
        console.log('Подключаюсь к серверу...');
        ws = new WebSocket(PROXY_SERVER);

        ws.onopen = () => {
            console.log('✓ Подключено к proxy серверу');
            updateExtensionStatus('connected', 'Подключено к серверу');
            startPingInterval();
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'pong') {
                    console.log('pong');
                } else {
                    commandRun(message);
                }
            } catch (error) {
                console.error('Ошибка обработки сообщения:', error);
            }
        };

        ws.onclose = (event) => {
            console.log('Соединение разорвано:', event.code, event.reason);
        };

        ws.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
            updateExtensionStatus('error', 'Ошибка подключения');
        };

    } catch (error) {
        console.error('Ошибка подключения:', error);
    }
}

function startPingInterval() {
    if (pingInterval) {
        clearInterval(pingInterval);
    }
    pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log('ping');
            ws.send(JSON.stringify({ type: 'ping' }));
        }
    }, 10000);
}

function updateExtensionStatus(status, message) {
    chrome.action.setTitle({ title: `Alice Client - ${message}` });
    chrome.storage.local.set({ extensionStatus: { status, message, timestamp: Date.now() } });
}

chrome.runtime.onStartup.addListener(() => {
    connectToProxy();
});

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        connectToProxy();
    }
});

// Управление подключением через сообщения от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'connect':
            connectToProxy();
            sendResponse({ success: true });
            break;
        case 'disconnect':
            if (ws) {
                ws.close();
                ws = null;
            }
            updateExtensionStatus('disconnected', 'Отключено вручную');
            sendResponse({ success: true });
            break;
        case 'getStatus':
            sendResponse({ 
                status: ws ? ws.readyState : WebSocket.CLOSED,
            });
            break;
    }
});

function openUrlInBrowser(searchUrl) {
    console.log('Проверяю существующие вкладки Yandex Search...');
    
    chrome.tabs.query({ url: 'https://yandex.ru/search*' }, (tabs) => {
        if (chrome.runtime.lastError) {
            console.error('Ошибка поиска вкладок:', chrome.runtime.lastError);
            createNewTab(searchUrl);
            return;
        }
        
        if (tabs && tabs.length > 0) {
            const activeTab = tabs.find(tab => tab.active) || tabs[0];
            
            chrome.tabs.update(activeTab.id, { 
                url: searchUrl,
                active: true 
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Ошибка обновления вкладки:', chrome.runtime.lastError);
                    createNewTab(searchUrl);
                } else {
                    console.log('Вкладка успешно обновлена');
                }
            });
        } else {
            console.log('Нет открытых вкладок Yandex Search. Создаю новую...');
            createNewTab(searchUrl);
        }
    });
}

function createNewTab(url) {
    chrome.tabs.create({ url: url }, (tab) => {
        if (chrome.runtime.lastError) {
            console.error('Ошибка открытия вкладки:', chrome.runtime.lastError);
        } else {
            console.log('URL успешно открыт в новой вкладке');
        }
    });
}

async function commandRun(command) {
    if (command.type === 'video control') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: (command) => {
                        let video = document.querySelector('video');
                        if (video && command.action) {
                            video[command.action]();
                        }
                    },
                    args: [command],
                });
            } catch (error) {
                console.error('Ошибка:', error);
            }
        });
    } else if (command.type === 'video') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        let video = document.querySelector('video');
                        if (video) video.requestFullscreen().then(() => video.play());
                    },
                });
            } catch (error) {
                console.error('Ошибка:', error);
            }
        });
    } else if (command.type === 'switch on') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        document.body.focus();
                        let video = document.querySelector('video');
                        if (!video) {
                            let iframe = document.querySelector('iframe');
                            if (iframe) {
                                let src = iframe.src || Object.values(iframe.dataset).find(x => x.includes("http"));
                                if (src) {
                                    window.location = src;
                                }
                            }
                        }
                    }
                });
                setTimeout(() => { ws.send(JSON.stringify({ type: 'eventKey', key: ' ' })) }, 1000);
            } catch (error) {
                console.error('Ошибка:', error);
            }
        });
    } else if (command.type === 'open') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        let link = document.querySelector(`a[href*="lordf"]`);
                        if (link) window.location = link.href;
                    }
                });
            } catch (error) {
                console.error('Ошибка:', error);
            }
        });
    } else if (command.type === 'close') {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.title && tab.title.toLowerCase().includes(command.text)) {
                    chrome.tabs.remove(tab.id);
                }
            });
        });
    } else {
        const encodedText = encodeURIComponent(command.text);
        const searchUrl = `https://yandex.ru/search?text=${encodedText}`;
        openUrlInBrowser(searchUrl);
    }
}
