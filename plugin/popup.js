const dot = document.getElementById("dot");
const statusText = document.getElementById("status");

function updateStatus(){

    chrome.runtime.sendMessage({action:"status"}, response=>{

        if(chrome.runtime.lastError){
            setDisconnected();
            return;
        }

        if(response && response.connected){
            setConnected();
        }else{
            setDisconnected();
        }
    });
}

function setConnected(){
    dot.classList.remove("disconnected");
    dot.classList.add("connected");
    statusText.textContent = "Подключено";
}

function setDisconnected(){
    dot.classList.remove("connected");
    dot.classList.add("disconnected");
    statusText.textContent = "Нет соединения";
}

updateStatus();
setInterval(updateStatus, 2000);
