const { mouse, keyboard, Key, Button } = require("@nut-tree-fork/nut-js");
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8765 });

console.log("🔥 Alice native bridge запущен");

wss.on("connection", ws => {

    console.log("extension connected");

    ws.on("message", async msg => {

        msg = msg.toString();
        console.log("cmd:", msg);

        if(msg === "click"){
            await mouse.click(Button.LEFT);
        }

        if(msg === "fullscreen"){
            await mouse.click(Button.LEFT);
            await mouse.click(Button.LEFT);
        }

        if(msg === "space"){
            await keyboard.pressKey(Key.Space);
            await keyboard.releaseKey(Key.Space);
        }

    });
});

// C:\Users\User\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup