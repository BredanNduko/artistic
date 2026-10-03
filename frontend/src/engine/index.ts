/**
 * Design Engine — public surface.
 *
 * Nothing outside `src/engine` should reach into individual modules; import
 * from here. This keeps the engine a stable, documented contract while its
 * internals stay free to change.
 *
 *   Content -> DesignDocument -> Design Engine -> Canvas Renderer -> Export
 */

export * from './types';
export * from './geometry';
export * from './factories';
export * from './ops';
export * from './history';
export * from './migrations';
export * from './validation';
export * from './analysis';

export {
  describeScene,
  describeElement,
  describeBackground,
  paintProps,
  collectImageSources,
  collectFontFamilies,
  isGradient,
  type NodeDescriptor,
  type KonvaNodeType,
} from './renderer/describe';

export {
  renderSceneToCanvas,
  renderSceneToDataURL,
  renderSceneToBlob,
  renderThumbnail,
  preloadImages,
  loadImage,
  ensureFonts,
  type RenderOptions,
  type RenderedScene,
} from './renderer/pureKonva';
