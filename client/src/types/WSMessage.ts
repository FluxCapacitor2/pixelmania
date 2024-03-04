export type WSMessage =
  | {
      action: "bulkPaint";
      data: (string | null)[][];
    }
  | {
      action: "setCanvas";
      data: (string | null)[][];
    }
  | {
      action:
        | "approveTransaction"
        | "approveTransactionForReview"
        | "denyTransaction"
        | "denyTransactionForReview";
      id: string;
    }
  | {
      action: "newTransaction" | "newTransactionForReview";
      id: string;
      pixelCount: number;
    }
  | { action: "login"; result: "success" | "failure" }
  | { action: "setPrice"; price: number };
