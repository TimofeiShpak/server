const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Базовый маршрут
app.get('/', (req, res) => {
  res.json({ 
    message: 'Сервер работает на Render!', 
    timestamp: new Date().toISOString()
  });
});

// Пример API маршрута
app.get('/api/users', (req, res) => {
  const users = [
    { id: 1, name: 'Иван', email: 'ivan@example.com' },
    { id: 2, name: 'Мария', email: 'maria@example.com' },
    { id: 3, name: 'Алексей', email: 'alexey@example.com' }
  ];
  res.json(users);
});

// Обработка POST запросов
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  console.log('Получено сообщение:', { name, email, message });
  res.json({ success: true, message: 'Сообщение получено' });
});

// Обработка ошибок 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Получение порта из переменных окружения или использование 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});