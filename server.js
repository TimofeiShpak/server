const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

// Хранилище подключенных клиентов
const clients = new Map();

// WebSocket соединение для локальных клиентов
wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substr(2, 9);
    clients.set(clientId, ws);
    
    console.log(`Новое подключение: ${clientId}`);
    
    ws.on('close', () => {
        clients.delete(clientId);
        console.log(`Отключение: ${clientId}`);
    });
});

// Маршрут для Алисы
app.post('/alice-webhook', async (req, res) => {
    try {
        const { request, session, version } = req.body;
        
        if (request.command.toLowerCase().includes('открой сайт')) {
            // Извлекаем текст из команды
            const text = request.command.replace(/открой сайт/gi, '').trim();
            
            if (clients.size === 0) {
                return res.json({
                    response: {
                        text: "Устройство не подключено к серверу",
                        end_session: true
                    },
                    version
                });
            }

            // Отправляем команду всем подключенным клиентам
            clients.forEach((ws, clientId) => {
                ws.send(JSON.stringify({
                    type: 'open_url',
                    text: text,
                    timestamp: new Date().toISOString()
                }));
            });

            return res.json({
                response: {
                    text: `Открываю сайт с текстом: ${text}`,
                    end_session: true
                },
                version
            });
        }

        res.json({
            response: {
                text: "Не поняла команду. Скажите 'Открой сайт [текст]'",
                end_session: true
            },
            version
        });

    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});