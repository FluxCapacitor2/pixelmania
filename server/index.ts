import { WebSocketHandler } from "bun";
import { randomBytes } from "crypto";

type Color = string;
type Transaction = {
  id: string;
  pixelCount: number;
  data: (string | null)[][];
};

let canvasState: (Color | null)[][] = [];
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
    return new Response("WebSocket upgrade failed :(", { status: 500 });
  },
  websocket: {
    publishToSelf: true,
    open(ws) {
      ws.data = { transactionIds: [] };
      ws.subscribe("users");
      ws.send(
        JSON.stringify({
          action: "setCanvas",
          data: canvasState,
        })
      );
      ws.send(
        JSON.stringify({
          action: "setPrice",
          price: pricePerPixel,
        })
      );
    },
    message(ws, messageString) {
      const msg = JSON.parse(messageString as string);

      if (process.env.NODE_ENV === "development") {
        console.log(msg);
      }

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
      } else if (msg.action === "startTransaction") {
        const { data } = msg as { data: (string | null)[][] };
        const id = randomBytes(4).toString("hex");
        ws.data.transactionIds.push(id);
        const pixels = pixelCount(data);
        pendingTransactions.push({ pixelCount: pixels, id, data });
        ws.publish(
          "admins",
          JSON.stringify({
            action: "newTransactionForReview",
            pixelCount: pixels,
            id,
          })
        );
        ws.send(
          JSON.stringify({
            action: "newTransaction",
            pixelCount: pixels,
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
        canvasState = merge(canvasState, pixels);
        pendingTransactions = pendingTransactions.filter((it) => it.id !== id);

        ws.publish(
          "users",
          JSON.stringify({
            action: "bulkPaint",
            data: pixels,
          })
        );
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
      } else if (msg.action === "setPrice") {
        if (!ws.isSubscribed("admins")) return;
        if (typeof msg.price !== "number") return;
        pricePerPixel = msg.price;
        ws.publish(
          "users",
          JSON.stringify({
            action: "setPrice",
            price: pricePerPixel,
          })
        );
      } else {
        console.log("Unknown WS message received:", msg);
      }
    },
    close(ws, code, reason) {
      // Clear transactions from users once they disconnect
      ws.data.transactionIds?.forEach((transaction) => {
        pendingTransactions = pendingTransactions.filter(
          (it) => it.id !== transaction
        );
        ws.publish(
          "admins",
          JSON.stringify({
            action: "denyTransactionForReview",
            id: transaction,
          })
        );
      });
    },
  } satisfies WebSocketHandler<{ transactionIds: string[] }>,
});

console.log(`Server running on http://${server.hostname}:${server.port}`);

function pixelCount(arr: (string | null)[][]) {
  return arr.reduce(
    (sum, row) =>
      sum + row.reduce((sum, col) => (col !== null ? sum + 1 : sum), 0),
    0
  );
}

function merge(
  serverState: (string | null)[][],
  clientState: (string | null)[][]
) {
  let mergedState = structuredClone(serverState);
  for (let x = 0; x < clientState.length; x++) {
    for (let y = 0; y < clientState[x].length; y++) {
      if (clientState[x][y]) mergedState[x][y] = clientState[x][y];
    }
  }
  return mergedState;
}
