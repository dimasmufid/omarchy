export type PinnedRequest = {
  url: string;
  method: "GET" | "POST" | "DELETE";
  fingerprint: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

export type PinnedUpload = Omit<PinnedRequest, "body"> & {
  fileUri: string;
};

export type NativeHttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export type DiscoveredDesktop = {
  id: string;
  name: string;
  host: string;
  port: number;
  protocolVersion: number;
};
