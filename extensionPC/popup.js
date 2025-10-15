document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const statusText = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    function updateStatus() {
        chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
            if (response) {
                let status, text, className;
                
                switch (response.status) {
                    case WebSocket.OPEN:
                        status = 'connected';
                        text = 'Подключено';
                        className = 'connected';
                        break;
                    case WebSocket.CONNECTING:
                        status = 'reconnecting';
                        text = 'Подключается...';
                        className = 'reconnecting';
                        break;
                    default:
                        status = 'disconnected';
                        text = 'Отключено';
                        className = 'disconnected';
                }
                
                statusDiv.textContent = text;
                statusDiv.className = `status ${className}`;
                statusText.textContent = text;
            }
        });
    }

    connectBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'connect' });
        setTimeout(updateStatus, 1000);
    });

    disconnectBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'disconnect' });
        setTimeout(updateStatus, 500);
    });

    // Обновляем статус каждые 10 секунд
    updateStatus();
    setInterval(updateStatus, 10000);
});