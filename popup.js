const TELNET_TARGETS = [
  "192.168.0.10",
  "192.168.0.11",
  "192.168.0.12"
];

// Укажите свои данные прямо в коде:
const TELNET_CREDENTIALS = {
  username: "admin",
  password: "admin123"
};

const BRIDGE_WS_URL = "ws://127.0.0.1:8765";

const targetEl = document.getElementById("target");
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const sendBtn = document.getElementById("sendBtn");
const commandEl = document.getElementById("command");
const statusEl = document.getElementById("status");
const terminalEl = document.getElementById("terminal");

let ws;

function setStatus(text) {
  statusEl.textContent = `Статус: ${text}`;
}

function appendTerminal(text) {
  terminalEl.textContent += `${text}\n`;
  terminalEl.scrollTop = terminalEl.scrollHeight;
}

function setConnectedUiState(isConnected) {
  connectBtn.disabled = isConnected;
  disconnectBtn.disabled = !isConnected;
  sendBtn.disabled = true;
}

function unlockCommands() {
  sendBtn.disabled = false;
}

function initTargets() {
  TELNET_TARGETS.forEach((ip) => {
    const opt = document.createElement("option");
    opt.value = ip;
    opt.textContent = ip;
    targetEl.appendChild(opt);
  });
}

function connectBridge() {
  ws = new WebSocket(BRIDGE_WS_URL);

  ws.addEventListener("open", () => {
    setStatus("bridge подключен, устанавливаем telnet...");
    const payload = {
      type: "connect",
      host: targetEl.value,
      port: 23,
      username: TELNET_CREDENTIALS.username,
      password: TELNET_CREDENTIALS.password
    };
    ws.send(JSON.stringify(payload));
  });

  ws.addEventListener("message", (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      appendTerminal(event.data);
      return;
    }

    if (msg.type === "status") {
      if (msg.value === "password отправлен") {
        unlockCommands();
      }
      setStatus(msg.value);
      return;
    }

    if (msg.type === "data") {
      appendTerminal(msg.value);
      return;
    }

    if (msg.type === "error") {
      setStatus(`ошибка: ${msg.value}`);
      return;
    }
  });

  ws.addEventListener("close", (event) => {
    if (event.code !== 1000) {
      setStatus(`соединение закрыто (code ${event.code})`);
    } else {
      setStatus("соединение закрыто");
    }
    setConnectedUiState(false);
  });

  ws.addEventListener("error", () => {
    setStatus("ошибка WebSocket до bridge (проверьте bridge и CSP)");
    setConnectedUiState(false);
  });
}

connectBtn.addEventListener("click", () => {
  terminalEl.textContent = "";
  setConnectedUiState(true);
  setStatus("подключение...");
  connectBridge();
});

disconnectBtn.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify({ type: "disconnect" }));
  ws.close();
});

sendBtn.addEventListener("click", () => {
  const command = commandEl.value.trim();
  if (!command || !ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify({ type: "command", value: command }));
  commandEl.value = "";
});

commandEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});

initTargets();
setConnectedUiState(false);
