const statusDiv = document.getElementById("status");
const btnConnect = document.getElementById("connect");
const btnDisconnect = document.getElementById("disconnect");

// =====================
// обновление UI статуса
// =====================

function setStatus(state, text){
    statusDiv.className = "";

    if(state === "connected"){
        statusDiv.classList.add("on");
    } 
    else if(state === "reconnecting"){
        statusDiv.classList.add("wait");
    } 
    else {
        statusDiv.classList.add("off");
    }

    statusDiv.textContent = text;

    // управление кнопками
    updateButtons(state);
}

// =====================
// показывать нужные кнопки
// =====================

function updateButtons(state){

    if(state === "connected"){
        btnConnect.style.display = "none";
        btnDisconnect.style.display = "block";
    }

    else if(state === "reconnecting"){
        btnConnect.style.display = "none";
        btnDisconnect.style.display = "none";
    }

    else { // off / error
        btnConnect.style.display = "block";
        btnDisconnect.style.display = "none";
    }
}

// =====================
// получить статус
// =====================

function refreshStatus(){
    chrome.storage.local.get("extensionStatus", (data)=>{
        if(!data.extensionStatus){
            setStatus("off","Нет данных");
            return;
        }

        const s = data.extensionStatus;
        setStatus(s.status, s.message);
    });
}

// =====================
// кнопки
// =====================

btnConnect.onclick = ()=>{
    chrome.runtime.sendMessage({action:"connect"}, ()=>{
        setTimeout(refreshStatus, 700);
    });
};

btnDisconnect.onclick = ()=>{
    chrome.runtime.sendMessage({action:"disconnect"}, ()=>{
        setTimeout(refreshStatus, 500);
    });
};

// =====================
// автообновление
// =====================

refreshStatus();
setInterval(refreshStatus, 2000);
