const http = require('http');
const WebSocket = require('ws');

const server = http.createServer(async (req, res) => {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }
    
    if (req.url.startsWith('/open') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const text = data.text || '';
                
                console.log('Получен текст для поиска:', text);
                
                // Отправляем всем подключенным клиентам
                if (wss) {
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'open_url',
                                text: text,
                                timestamp: new Date().toISOString()
                            }));
                        }
                    });
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: 'Команда отправлена на клиент'
                }));
                
            } catch (error) {
                console.error('Ошибка:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            message: 'WebSocket proxy сервер работает!',
            connected_clients: wss ? wss.clients.size : 0
        }));
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

// WebSocket сервер
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    console.log('Новый клиент подключен');
    
    ws.on('close', () => {
        console.log('Клиент отключен');
    });
});

// Обработка upgrade для WebSocket
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket доступен по wss://your-render-app.onrender.com`);
});