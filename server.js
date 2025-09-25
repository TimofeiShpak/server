const http = require('http');
const WebSocket = require('ws');

const server = http.createServer(async (req, res) => {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const data = JSON.parse(body);
            const text = data.text || '';
            if (wss) {
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            text: text,
                            timestamp: new Date().toISOString()
                        }));
                    }
                });
            }
        } catch (error) {
            console.error('Ошибка:', error);
        }
    });

    res.writeHead(200);
    return res.end();
});

// WebSocket сервер
const wss = new WebSocket.Server({ noServer: true });

// Обработка upgrade для WebSocket
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {});