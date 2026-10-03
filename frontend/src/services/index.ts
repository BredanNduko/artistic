/**
 * Services barrel. Components import services from here only.
 */

export * from './httpClient';
export { authService, type AuthService, type User, type Credentials } from './authService';
export {
  templateService,
  type TemplateService,
  type TemplateQuery,
  type TemplatePage,
} from './templateService';
export {
  projectService,
  type ProjectService,
  type ProjectSummary,
} from './projectService';
export {
  assetService,
  UPLOAD_LIMITS,
  SUPPORTED_UPLOAD_KINDS,
  type AssetService,
  type Asset,
  type AssetKind,
  type UploadOptions,
} from './assetService';
export {
  exportService,
  EXPORT_PRESETS,
  type ExportService,
  type ExportOptions,
  type ExportFormat,
  type ExportResult,
} from './exportService';
export {
  brandKitService,
  emptyBrandKit,
  starterBrandKit,
  type BrandKitService,
  type BrandKit,
  type BrandColor,
  type BrandFont,
  type BrandLogo,
  type BrandSocialLink,
  type BrandBusinessInfo,
} from './brandKitService';
export {
  aiService,
  localAIStatus,
  AI_CAPABILITIES,
  palettePreview,
  type AIService,
  type GenerateDesignRequest,
  type ModifyDesignRequest,
  type ResizeRequest,
  type CopyRequest,
  type CopyResult,
  type GeneratedImage,
  type AIStatus,
} from './aiService';
