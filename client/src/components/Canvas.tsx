import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { WSMessage } from "../types/WSMessage";
import { BrushSizePicker } from "./BrushSizePicker";
import { ColorPicker } from "./ColorPicker";

const sideLength = 100;
const width = sideLength;
const height = sideLength;

export const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { lastJsonMessage, sendJsonMessage, readyState } =
    useWebSocket<WSMessage>(
      import.meta.env.VITE_SERVER_URL ??
        `ws://${window.location.hostname}:8080/ws`,
      {
        retryOnError: true,
        reconnectAttempts: -1,
        reconnectInterval: 100,
        onClose() {
          toast.error("There was a problem connecting to the server!", {
            duration: 3000,
          });
        },
        onOpen: () =>
          canvasRef.current?.getContext("2d")?.clearRect(0, 0, width, height),
      }
    );

  const newCanvas = () =>
    Array(width)
      .fill(null)
      .map(() => new Array(height).fill(null));

  const [canvasState, setCanvasState] = useState<(string | null)[][]>(
    newCanvas()
  );

  const [localCanvasState, setLocalCanvasState] = useState<(string | null)[][]>(
    newCanvas()
  );

  const ctx = canvasRef.current?.getContext("2d");
  const [color, setColor] = useState<string | null>("black");
  const [thickness, setThickness] = useState(1);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [transactions, setTransactions] = useState<
    { id: string; pixelCount: number }[]
  >([]);

  const [pricePerPixel, setPrice] = useState(1 / 75);

  const drawCanvas = (canvas: (string | null)[][]) => {
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    canvas.forEach((row, x) => {
      row.forEach((col, y) => {
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(x, y, 1, 1);
        } else {
          ctx.clearRect(x, y, 1, 1);
        }
      });
    });
  };

  const merge = (
    serverState: (string | null)[][],
    clientState: (string | null)[][]
  ) => {
    let mergedState = structuredClone(serverState);
    for (let x = 0; x < clientState.length; x++) {
      for (let y = 0; y < clientState[x].length; y++) {
        if (clientState[x][y]) mergedState[x][y] = clientState[x][y];
      }
    }
    return mergedState;
  };

  useEffect(() => {
    drawCanvas(merge(canvasState, localCanvasState));
  }, [canvasState, localCanvasState]);

  useEffect(() => {
    if (!lastJsonMessage) return;
    console.log(lastJsonMessage);
    if (lastJsonMessage.action === "bulkPaint" && ctx) {
      setCanvasState(merge(canvasState, lastJsonMessage.data));
    } else if (lastJsonMessage.action === "setCanvas" && ctx) {
      setIsAdmin(false);
      const data = lastJsonMessage.data;
      setCanvasState(data);
    } else if (lastJsonMessage.action === "approveTransaction") {
      // The transaction was approved!
      setTransactionId(null);
      toast.success("Transaction approved!");
      setLocalCanvasState(newCanvas());
    } else if (lastJsonMessage.action === "denyTransaction") {
      setTransactionId(null);
      setLocalCanvasState(newCanvas());
      toast.error(
        "Your transaction was denied. Please visit the table for more information."
      );
    } else if (lastJsonMessage.action === "login") {
      if (lastJsonMessage.result === "success") {
        toast.success("You are now logged in as an admin.");
        setIsAdmin(true);
      } else {
        toast.error("Incorrect password");
      }
    } else if (lastJsonMessage.action === "newTransaction") {
      if (!isAdmin) {
        setTransactionId(lastJsonMessage.id);
      }
    } else if (lastJsonMessage.action === "newTransactionForReview") {
      setTransactions([...transactions, lastJsonMessage]);
    } else if (
      lastJsonMessage.action === "denyTransactionForReview" ||
      lastJsonMessage.action === "approveTransactionForReview"
    ) {
      setTransactions(
        transactions.filter((it) => it.id !== lastJsonMessage.id)
      );
    } else if (lastJsonMessage.action === "setPrice") {
      setPrice(lastJsonMessage.price);
    }
  }, [lastJsonMessage]);

  const [drawing, setDrawing] = useState(false);

  const newPixels = useMemo(() => {
    return localCanvasState.reduce(
      (sum, row) =>
        sum + row.reduce((sum, col) => (col !== null ? sum + 1 : sum), 0),
      0
    );
  }, [localCanvasState]);

  const [lastDrawPos, setLastDrawPos] = useState<[number, number] | null>(null);

  const draw = (clientX: number, clientY: number) => {
    if (transactionId !== null) return;
    const rect = canvasRef.current!.getBoundingClientRect();

    const screenX = clientX - rect.x;
    const screenY = clientY - rect.y;
    const [x, y] = [
      Math.round(screenX * (width / rect.width)),
      Math.round(screenY * (height / rect.height)),
    ];
    setLastDrawPos([x, y]);

    if (lastDrawPos) {
      const dx = x - lastDrawPos[0];
      const dy = y - lastDrawPos[1];
      let greatestDifferential = Math.max(Math.abs(dx), Math.abs(dy));
      for (let t = 0; t < Math.abs(greatestDifferential); t++) {
        paintPixel(
          lastDrawPos[0] + (dx / greatestDifferential) * t,
          lastDrawPos[1] + (dy / greatestDifferential) * t
        );
      }
    }

    paintPixel(x, y);
  };

  useEffect(() => {
    if (!drawing) {
      setLastDrawPos(null);
    }
  }, [drawing]);

  const paintPixel = (x: number, y: number) => {
    let newState = structuredClone(localCanvasState);

    for (let dx = -thickness; dx < thickness; dx++) {
      for (let dy = -thickness; dy < thickness; dy++) {
        if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) {
          // Don't paint pixels out of bounds
          continue;
        }

        newState[Math.round(x + dx)][Math.round(y + dy)] = color;
      }
    }

    setLocalCanvasState(newState);
  };

  const startTransaction = () => {
    sendJsonMessage({
      action: "startTransaction",
      data: localCanvasState,
    });
  };

  useEffect(() => {
    if (readyState !== ReadyState.OPEN) {
      toast.loading("Connecting...", {
        duration: 60000,
        id: "reconnecting",
      });
    } else {
      toast.success("Connected!", { id: "reconnecting", duration: 500 });
    }
  }, [readyState]);

  return (
    <>
      <section className="flex flex-col items-center gap-4">
        {transactionId !== null && (
          <div className="rounded-md border-2 bg-green-200 p-4">
            <p className="max-w-md">
              Your request has been submitted! Come to the table to complete the
              transaction. Your transaction ID is: <b>{transactionId}</b>
            </p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border rounded-sm w-[95vw] md:w-auto md:min-h-[80vh] aspect-square [image-rendering:pixelated]"
          onMouseDown={(e) => {
            setDrawing(true);
            draw(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            setDrawing(true);
            if (e.touches?.[0]) {
              draw(e.touches[0].clientX, e.touches[0].clientY);
            }
            return false; // for iOS - see https://stackoverflow.com/a/9975966
          }}
          onMouseMove={(e) => {
            if (drawing) draw(e.clientX, e.clientY);
          }}
          onTouchMove={(e) => {
            if (drawing) draw(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onMouseUp={() => setDrawing(false)}
          onMouseLeave={() => setDrawing(false)}
          onTouchEnd={() => setDrawing(false)}
        />
        <div className="flex gap-4 items-center">
          <BrushSizePicker setThickness={setThickness} />
          <div className="w-px h-full scale-y-125 bg-gray-400">&nbsp;</div>
          <ColorPicker setColor={setColor} />
        </div>
        {transactionId === null && (
          <div className="flex gap-2">
            <button
              onClick={() => startTransaction()}
              disabled={
                readyState !== ReadyState.OPEN ||
                newPixels === 0 ||
                transactionId !== null
              }
              className="rounded-md bg-pink-500 disabled:bg-pink-400 hover:bg-pink-600 active:bg-pink-700 transition-colors py-2 px-3 text-white"
            >
              🖌 Paint {newPixels} pixels ($
              {Math.round(newPixels * pricePerPixel * 100) / 100})
            </button>
            <button
              onClick={() => setLocalCanvasState(newCanvas())}
              disabled={newPixels === 0 || transactionId !== null}
              className="rounded-md bg-gray-500 disabled:bg-gray-400 hover:bg-gray-600 active:bg-gray-700 transition-colors py-2 px-3 text-white"
            >
              Cancel
            </button>
          </div>
        )}
        {!isAdmin && (
          <input
            type="text"
            placeholder="Admin password..."
            className="fixed bottom-1 right-1"
            disabled={readyState !== ReadyState.OPEN}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendJsonMessage({
                  action: "login",
                  password: e.currentTarget.value,
                });
              }
            }}
          />
        )}
      </section>
      {isAdmin && (
        <section className="flex flex-col gap-4 h-full items-start justify-start border rounded-md p-4">
          <h2 className="text-lg font-bold font-mono">Admin</h2>
          <input
            type="text"
            disabled={readyState !== ReadyState.OPEN}
            placeholder="Set price..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendJsonMessage({
                  action: "setPrice",
                  price: parseFloat(e.currentTarget.value),
                });
              }
            }}
          />
          {transactions.length === 0 && <p>No pending transactions.</p>}
          {transactions.map((transaction) => (
            <div className="border rounded-md p-4" key={transaction.id}>
              <h2 className="text-lg font-mono font-bold">
                Transaction {transaction.id}
              </h2>
              <p>
                {transaction.pixelCount} pixels &middot; $
                {Math.round(transaction.pixelCount * pricePerPixel * 100) / 100}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    sendJsonMessage({
                      action: "approveTransaction",
                      id: transaction.id,
                    })
                  }
                  className="bg-green-400 rounded-md px-2 py-1 disabled:bg-green-300"
                  disabled={readyState !== ReadyState.OPEN}
                >
                  Approve
                </button>
                <button
                  onClick={() =>
                    sendJsonMessage({
                      action: "denyTransaction",
                      id: transaction.id,
                    })
                  }
                  className="bg-red-400 rounded-md px-2 py-1 disabled:bg-red-300"
                  disabled={readyState !== ReadyState.OPEN}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
};
