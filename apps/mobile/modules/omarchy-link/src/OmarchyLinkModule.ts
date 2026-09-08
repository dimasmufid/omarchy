import { NativeModule, requireNativeModule } from 'expo';

import type {
  DiscoveredDesktop,
  NativeHttpResponse,
  PinnedRequest,
  PinnedUpload,
} from './OmarchyLink.types';

declare class OmarchyLinkModule extends NativeModule<{}> {
  requestAsync(optionsJson: string): Promise<string>;
  uploadAsync(optionsJson: string): Promise<string>;
  discoverAsync(timeoutMs: number): Promise<string>;
}

const native = requireNativeModule<OmarchyLinkModule>('OmarchyLink');

export async function pinnedRequest(options: PinnedRequest): Promise<NativeHttpResponse> {
  return JSON.parse(await native.requestAsync(JSON.stringify(options))) as NativeHttpResponse;
}

export async function pinnedUpload(options: PinnedUpload): Promise<NativeHttpResponse> {
  return JSON.parse(await native.uploadAsync(JSON.stringify(options))) as NativeHttpResponse;
}

export async function discoverDesktops(timeoutMs = 1_500): Promise<DiscoveredDesktop[]> {
  return JSON.parse(await native.discoverAsync(timeoutMs)) as DiscoveredDesktop[];
}

export default native;
