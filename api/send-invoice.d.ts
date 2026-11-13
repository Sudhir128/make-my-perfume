export interface InvoiceDispatchResult {
  statusCode: number;
  payload: {
    dispatched: boolean;
    status: string;
    provider?: string;
    message?: string;
  };
}

export function dispatchInvoiceEmailPayload(body: Record<string, unknown>): Promise<InvoiceDispatchResult>;

