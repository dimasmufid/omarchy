import { registerWebModule, NativeModule } from 'expo';

// OmarchyLinkModule is not available on the web platform.
class OmarchyLinkModule extends NativeModule<{}> {
  async requestAsync(): Promise<string> {
    throw new Error('Pinned LAN requests require an Android or iOS development build.');
  }

  async uploadAsync(): Promise<string> {
    throw new Error('Pinned LAN uploads require an Android or iOS development build.');
  }

  async cancelUploadAsync(): Promise<void> {}

  async discoverAsync(): Promise<string> {
    return '[]';
  }
}

export default registerWebModule(OmarchyLinkModule, 'OmarchyLinkModule');
