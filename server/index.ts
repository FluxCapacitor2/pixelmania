import { randomBytes } from "crypto";

type Color = string;
type Transaction = {
  id: string;
  pixelCount: number;
  data: { x: number; y: number; color: string }[];
};

let canvasState: Color[][] = [];
let pendingTransactions: Transaction[] = [];
let pricePerPixel = 1 / 75;

const size = 100;
for (let x = 0; x < size; x++) {
  canvasState[x] = Array.from({ length: size });
}

const server = Bun.serve({
  port: 8080,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return; // do not return a Response
    }
    return new Response("Upgrade failed :(", { status: 500 });
  },
  websocket: {
    publishToSelf: true,
    open(ws) {
      ws.subscribe("pixel-updates");
      ws.send(
        JSON.stringify({
          action: "setCanvas",
          data: canvasState,
        })
      );
      ws.send(
        JSON.stringify({
          action: "setPrice",
          data: pricePerPixel,
        })
      );
    },
    message(ws, messageString) {
      const msg = JSON.parse(messageString as string);

      const paint = (x: number, y: number, color: string) => {
        if (
          x < 0 ||
          x > canvasState.length ||
          y < 0 ||
          y > canvasState[0].length
        ) {
          return; // Ignore out-of-bounds pixels
        }
        canvasState[x][y] = color;
        ws.publish(
          "pixel-updates",
          JSON.stringify({
            action: "paint",
            x: x,
            y: y,
            color: color,
          })
        );
      };

      if (msg.action === "login") {
        if (msg.password === process.env.PASSWORD) {
          ws.subscribe("admins");
          ws.send(JSON.stringify({ action: "login", result: "success" }));
          for (const transaction of pendingTransactions) {
            ws.send(
              JSON.stringify({
                action: "newTransactionForReview",
                pixelCount: transaction.pixelCount,
                id: transaction.id,
              })
            );
          }
        } else {
          ws.send(JSON.stringify({ action: "login", result: "failure" }));
        }
      } else if (msg.action === "paint") {
        if (ws.isSubscribed("admins")) {
          paint(msg.x, msg.y, msg.color);
        }
      }
      if (msg.action === "startTransaction") {
        const { data } = msg;
        if (data.length <= 0) return;
        const id = randomBytes(4).toString("hex");
        pendingTransactions.push({ pixelCount: data.length, id, data });
        ws.publish(
          "admins",
          JSON.stringify({
            action: "newTransactionForReview",
            pixelCount: data.length,
            id,
          })
        );
        ws.send(
          JSON.stringify({
            action: "newTransaction",
            pixelCount: data.length,
            id,
          })
        );
        ws.subscribe(`transaction-${id}`);
      } else if (msg.action === "approveTransaction") {
        if (!ws.isSubscribed("admins")) return;
        const { id } = msg;
        ws.publish(
          `transaction-${id}`,
          JSON.stringify({
            action: "approveTransaction",
            id,
          })
        );
        ws.publish(
          `admins`,
          JSON.stringify({
            action: "approveTransactionForReview",
            id,
          })
        );
        const pixels = pendingTransactions.find((it) => it.id === id)?.data;
        if (!pixels) return; // unexpected error
        for (const pixel of pixels) {
          paint(pixel.x, pixel.y, pixel.color);
        }
        pendingTransactions = pendingTransactions.filter((it) => it.id !== id);
      } else if (msg.action === "denyTransaction") {
        if (!ws.isSubscribed("admins")) return;
        const { id } = msg;
        pendingTransactions = pendingTransactions.filter((it) => it.id !== id);
        ws.publish(
          `transaction-${id}`,
          JSON.stringify({
            action: "denyTransaction",
            id,
          })
        );
        ws.publish(
          `admins`,
          JSON.stringify({
            action: "denyTransactionForReview",
            id,
          })
        );
      }
    },
  },
});

console.log(`Server running on http://${server.hostname}:${server.port}`);
