import net from "node:net";
import { WebSocketServer } from "ws";

const BRIDGE_PORT = 8765;
const wss = new WebSocketServer({ port: BRIDGE_PORT, host: "127.0.0.1" });

console.log(`[bridge] WebSocket bridge started at ws://127.0.0.1:${BRIDGE_PORT}`);

wss.on("connection", (client) => {
  let telnetSocket = null;
  let isAuthorized = false;

  const send = (obj) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(obj));
    }
  };

  client.on("message", (rawData) => {
    let msg;
    try {
      msg = JSON.parse(rawData.toString());
    } catch {
      send({ type: "error", value: "Некорректный JSON" });
      return;
    }

    if (msg.type === "connect") {
      const { host, port = 23, username, password } = msg;
      telnetSocket = net.createConnection({ host, port }, () => {
        send({ type: "status", value: `telnet connected to ${host}:${port}` });
      });

      telnetSocket.setEncoding("utf8");

      telnetSocket.on("data", (chunk) => {
        const data = chunk.toString();
        send({ type: "data", value: data });

        if (!isAuthorized) {
          const lower = data.toLowerCase();

          if (lower.includes("login:") || lower.includes("username:")) {
            telnetSocket.write(`${username}\n`);
            return;
          }

          if (lower.includes("password:")) {
            telnetSocket.write(`${password}\n`);
            isAuthorized = true;
            send({ type: "status", value: "авторизация отправлена" });
          }
        }
      });

      telnetSocket.on("error", (err) => {
        send({ type: "error", value: `telnet error: ${err.message}` });
      });

      telnetSocket.on("close", () => {
        send({ type: "status", value: "telnet соединение закрыто" });
      });

      return;
    }

    if (msg.type === "command") {
      if (!telnetSocket || telnetSocket.destroyed) {
        send({ type: "error", value: "Нет активного telnet подключения" });
        return;
      }
      telnetSocket.write(`${msg.value}\n`);
      return;
    }

    if (msg.type === "disconnect") {
      if (telnetSocket && !telnetSocket.destroyed) {
        telnetSocket.end();
      }
      send({ type: "status", value: "disconnected" });
    }
  });

  client.on("close", () => {
    if (telnetSocket && !telnetSocket.destroyed) {
      telnetSocket.end();
    }
  });
});
