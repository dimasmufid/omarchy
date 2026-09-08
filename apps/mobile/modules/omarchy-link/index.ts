// Re-export the native module. On web, it will be resolved to OmarchyLinkModule.web.ts
// and on native platforms to OmarchyLinkModule.ts
export { default } from './src/OmarchyLinkModule';
export * from './src/OmarchyLink.types';
