// server.js
const WebSocket = require('ws');
const { exec } = require('child_process');
const http = require('http');
const loudness = require('loudness');

class ExtensionServer {
    constructor() {
        this.clients = new Set();
        this.setupWebSocket();
    }
    
    setupWebSocket() {
        const server = http.createServer();
        this.wss = new WebSocket.Server({ server });
        
        this.wss.on('connection', (ws) => {
            console.log('Extension connected');
            this.clients.add(ws);
            
            ws.on('message', (data) => {
                this.handleMessage(ws, data);
            });
            
            ws.on('close', () => {
                console.log('Extension disconnected');
                this.clients.delete(ws);
            });
        });
        
        server.listen(8080, () => {
            console.log('Extension server running on port 8080');
        });
    }
    
    broadcast(message) {
        const data = JSON.stringify(message);
        this.clients.forEach(client => {
            console.log('send message: ' + data);
            try {
                client.send(data);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });
    }

    handleMessage(ws, data) {
        try {
            const message = JSON.parse(data);
            console.log('handleMessage', message);
            if (message.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            } else if (message.type === 'eventKey') {
                let command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\\\"${message.key}\\\")"`;
                exec(command, () => {
                    ws.send(JSON.stringify({ type: 'video' }))
                    exec(command);
                });
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }
}
// Запуск сервера
let pcServer = new ExtensionServer();


// ws yandex
const PROXY_SERVER = 'wss://server-03cr.onrender.com';
let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 6;
const delayOn = 1000 * 60 * 14;
function connectToProxy() {
    try {
        ws = new WebSocket(PROXY_SERVER);

        ws.onopen = () => {
            console.log('✓ Подключено к proxy серверу');
            reconnectAttempts = 0;
            checkChromeRunning();
        };

        ws.onmessage = (event) => {
            try {
                checkChromeRunning()
                    .then(() => {
                        const message = JSON.parse(event.data);
                        console.log(message);
                        runCommand(message);
                    });
            } catch (error) {
                console.error('Ошибка обработки сообщения:', error);
            }
        };

        ws.onclose = (event) => {
            console.log('Соединение разорвано:', event.code, event.reason);
            handleReconnection();
        };

        ws.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
        };

    } catch (error) {
        console.error('Ошибка подключения:', error);
        handleReconnection();
    }
}

function handleReconnection() {
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`Переподключение через ${delayOn/1000} секунд... (попытка ${reconnectAttempts}/${maxReconnectAttempts})`);
        
        setTimeout(() => {
            connectToProxy();
        }, delayOn);
    } else {
        console.log('Достигнут лимит попыток переподключения');
    }
}   
connectToProxy();

function checkChromeRunning() {
    return new Promise((resolve, reject) => {
        exec('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV', (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            const lines = stdout.split('\n');
            const chromeProcesses = lines.filter(line => 
                line.includes('chrome.exe') && !line.includes('Image Name')
            );
            if (!chromeProcesses.length) {
                exec('start chrome', () => resolve());
            } else {
                resolve();
            }
        });
    });
}

async function runCommand(response) {
    if (!response?.text) return;

    let words = (response.text || '').toLowerCase().split(" ");
    let firstWordIndex = 0;
    
    if (words[firstWordIndex] === 'алиса') {
        firstWordIndex++;
    }
    
    let searchWords = ['найди', 'найти', 'поищи', 'ищи', 'поиск'];
    let videoControlWords = { 'пауза': 'pause', 'продолжить': 'play', 'продолжи': 'play' };
    let type = 'search';
    let action = null;
    
    if (words[firstWordIndex] === 'громкость') {
        let volumeValue = { 'один': 10, 'два': 20, 'три': 30, 'четыре': 40, 'пять': 50, 'шесть': 60, 'семь': 70, 'восемь': 80, 'девять': 90, 'десять': 100 };
        firstWordIndex++;
        let text = words.slice(firstWordIndex).join(" ").trim();
        if (volumeValue[text]) {
            const mute = await loudness.getMuted();
            if (mute) {
                await loudness.setMuted(false);
            }
            await loudness.setVolume(volumeValue[text]);
        }
    } else {
        if (words[firstWordIndex] === 'включи') {
            type = 'switch on';
            firstWordIndex++;
        } else if (words[firstWordIndex] === 'закрой') {
            type = 'close';
            firstWordIndex++;
        } if (words[firstWordIndex] === 'открой') {
            type = 'open';
            firstWordIndex++;
        } else if (Object.keys(videoControlWords).includes(words[firstWordIndex])) {
            type = 'video control';
            action = videoControlWords[words[firstWordIndex]];
            firstWordIndex++;
        }   else if (searchWords.includes(words[firstWordIndex])) {
            firstWordIndex++;
        }

        pcServer.broadcast({
            type,
            text: words.slice(firstWordIndex).join(" ").trim(),
            action,
        });
    }
}