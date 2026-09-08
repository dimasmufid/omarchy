import { NativeModule, requireNativeModule } from 'expo';

import type {
  DiscoveredDesktop,
  NativeHttpResponse,
  PinnedRequest,
  PinnedUpload,
  UploadProgressEvent,
} from './OmarchyLink.types';

type OmarchyLinkEvents = {
  onUploadProgress: (event: UploadProgressEvent) => void;
};

declare class OmarchyLinkModule extends NativeModule<OmarchyLinkEvents> {
  requestAsync(optionsJson: string): Promise<string>;
  uploadAsync(optionsJson: string): Promise<string>;
  cancelUploadAsync(uploadId: string): Promise<void>;
  discoverAsync(timeoutMs: number): Promise<string>;
}

const native = requireNativeModule<OmarchyLinkModule>('OmarchyLink');

export async function pinnedRequest(options: PinnedRequest): Promise<NativeHttpResponse> {
  return JSON.parse(await native.requestAsync(JSON.stringify(options))) as NativeHttpResponse;
}

export async function pinnedUpload(
  options: PinnedUpload,
  onProgress?: (event: UploadProgressEvent) => void,
  signal?: AbortSignal,
): Promise<NativeHttpResponse> {
  if (signal?.aborted) throw new Error('File transfer canceled.');
  const subscription = onProgress
    ? native.addListener('onUploadProgress', (event) => {
        if (event.uploadId === options.uploadId) onProgress(event);
      })
    : undefined;
  const cancel = () => { void native.cancelUploadAsync(options.uploadId); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const response = await native.uploadAsync(JSON.stringify(options));
    if (signal?.aborted) throw new Error('File transfer canceled.');
    return JSON.parse(response) as NativeHttpResponse;
  } catch (error) {
    if (signal?.aborted) throw new Error('File transfer canceled.');
    throw error;
  } finally {
    subscription?.remove();
    signal?.removeEventListener('abort', cancel);
  }
}

export async function discoverDesktops(timeoutMs = 1_500): Promise<DiscoveredDesktop[]> {
  return JSON.parse(await native.discoverAsync(timeoutMs)) as DiscoveredDesktop[];
}

export default native;
