const http = require('http');
const { exec } = require('child_process');

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
                
                console.log('Получен текст:', text);
                
                // На Render нельзя открывать браузер, поэтому возвращаем URL
                const url = `https://yandex.ru/search?text=${encodeURIComponent(text)}`;
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    text: text,
                    url: url,
                    message: 'На локальном сервере бы открылся браузер с этим URL'
                }));
                
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (req.url === '/' && req.method === 'GET') {
        // Добавляем корневой маршрут для проверки
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            message: 'Сервер работает на Render!',
            endpoints: {
                'POST /open': 'Принимает JSON с текстом для поиска'
            }
        }));
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

// Получаем порт из переменных окружения Render
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});