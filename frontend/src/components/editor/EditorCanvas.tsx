/**
 * EditorCanvas — the interactive renderer.
 *
 * Architecture note: this component is the *interactive* consumer of the
 * design document. It renders the same elements the offline export renderer
 * does, using the shared `paintProps` helpers from the engine so a gradient or
 * a shadow looks identical in both. The only difference is that here nodes are
 * draggable and attachable to a Transformer.
 *
 * All mutations are delegated to the editor store; the canvas never owns state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import {
  Arrow,
  Ellipse,
  Group as KonvaGroup,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  RegularPolygon,
  Ring,
  Stage,
  Star,
  Text as KonvaText,
  Transformer,
} from 'react-konva';
import {
  collectImageSources,
  computeSnap,
  findElement,
  flatten,
  paintProps,
  type DesignElement,
  type GroupElement,
  type ImageElement,
  type LineElement,
  type ShapeElement,
  type TextElement,
} from '@/engine';
import { useEditorStore, useUIStore } from '@/stores';
import { useElementSize, useImageMap } from '@/hooks/useEditorUtils';

/* ------------------------------------------------------------------ */
/* Node rendering                                                      */
/* ------------------------------------------------------------------ */

interface NodeProps {
  element: DesignElement;
  offset: { dx: number; dy: number };
  images: Map<string, HTMLImageElement>;
  /** registry so the Transformer can find real nodes */
  register: (id: string, node: Konva.Node | null) => void;
  /** elements are only interactive when nothing is being cropped */
  interactive: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, node: Konva.Node) => void;
  onDragEnd: (id: string, node: Konva.Node) => void;
  onDoubleClick: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

const transformProps = (el: DesignElement, offset: { dx: number; dy: number }) => ({
  x: el.x - offset.dx + el.width / 2,
  y: el.y - offset.dy + el.height / 2,
  offsetX: el.width / 2,
  offsetY: el.height / 2,
  rotation: el.rotation,
  opacity: el.opacity,
  visible: !el.hidden,
});

const shadowProps = (el: DesignElement) =>
  el.shadow
    ? {
        shadowColor: el.shadow.color,
        shadowBlur: el.shadow.blur,
        shadowOffsetX: el.shadow.offsetX,
        shadowOffsetY: el.shadow.offsetY,
        shadowOpacity: el.shadow.opacity,
      }
    : {};

function applyTextTransform(text: string, el: TextElement): string {
  if (el.textTransform === 'uppercase') return text.toUpperCase();
  if (el.textTransform === 'lowercase') return text.toLowerCase();
  if (el.textTransform === 'capitalize') return text.replace(/\b\w/g, (c) => c.toUpperCase());
  return text;
}

/** Applies Konva filters, which require the node to be cached first. */
function useFilteredNode(
  nodeRef: React.RefObject<Konva.Node | null>,
  filter: ImageElement['filter'] | undefined,
) {
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const hasFilter =
      filter &&
      Object.values(filter).some((value) => value !== undefined && value !== null);
    try {
      if (hasFilter) {
        node.cache();
      } else {
        node.clearCache();
      }
    } catch {
      /* caching is best-effort; the node still draws unfiltered */
    }
  }, [nodeRef, filter]);
}

function ImageNode({
  el,
  offset,
  images,
  register,
  interactive,
  ...handlers
}: NodeProps & { el: ImageElement }) {
  const ref = useRef<Konva.Image>(null);
  const image = images.get(el.src) ?? null;
  useFilteredNode(ref, el.filter);

  const crop = useMemo(() => {
    if (!el.crop || !image) return undefined;
    const nw = image.naturalWidth || image.width;
    const nh = image.naturalHeight || image.height;
    return {
      x: el.crop.x * nw,
      y: el.crop.y * nh,
      width: el.crop.width * nw,
      height: el.crop.height * nh,
    };
  }, [el.crop, image]);

  useEffect(() => {
    register(el.id, ref.current);
    return () => register(el.id, null);
  }, [el.id, register]);

  const shared = {
    id: el.id,
    name: `element:${el.id}`,
    draggable: interactive && !el.locked,
    onMouseEnter: () => handlers.onHover(el.id),
    onMouseLeave: () => handlers.onHover(null),
    onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      handlers.onSelect(el.id, event.evt.shiftKey || event.evt.metaKey);
    },
    onDragStart: () => handlers.onDragStart(el.id),
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) =>
      handlers.onDragMove(el.id, event.target),
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => handlers.onDragEnd(el.id, event.target),
    onDblClick: () => handlers.onDoubleClick(el.id),
    onContextMenu: (event: Konva.KonvaEventObject<PointerEvent>) => {
      event.evt.preventDefault();
      handlers.onContextMenu(el.id, event.evt.clientX, event.evt.clientY);
    },
  };

  if (!image) {
    // Placeholder keeps layout stable while an image decodes, or if it fails.
    return (
      <Rect
        {...shared}
        ref={ref as unknown as React.RefObject<Konva.Rect>}
        {...transformProps(el, offset)}
        width={el.width}
        height={el.height}
        cornerRadius={el.cornerRadius ?? 0}
        fill="#e2e8f0"
        stroke="#cbd5e1"
        strokeWidth={1}
      />
    );
  }

  return (
    <>
      <KonvaImage
        {...shared}
        ref={ref}
        {...transformProps(el, offset)}
        image={image}
        width={el.width}
        height={el.height}
        crop={crop}
        cornerRadius={el.cornerRadius ?? 0}
        {...shadowProps(el)}
      />
      {el.tint && (
        <Rect
          listening={false}
          {...transformProps(el, offset)}
          width={el.width}
          height={el.height}
          cornerRadius={el.cornerRadius ?? 0}
          fill={el.tint}
          opacity={(el.tintOpacity ?? 0.35) * el.opacity}
        />
      )}
    </>
  );
}

function ShapeNode({
  el,
  offset,
  register,
  interactive,
  ...handlers
}: NodeProps & { el: ShapeElement }) {
  // Intentionally loosely typed: one ref is shared across every Konva shape
  // node type rendered below, and react-konva types each node class strictly.
  const ref = useRef<any>(null);
  useEffect(() => {
    register(el.id, ref.current);
    return () => register(el.id, null);
  }, [el.id, register]);

  const shared = {
    id: el.id,
    ref,
    draggable: interactive && !el.locked,
    onMouseEnter: () => handlers.onHover(el.id),
    onMouseLeave: () => handlers.onHover(null),
    onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      handlers.onSelect(el.id, event.evt.shiftKey || event.evt.metaKey);
    },
    onDragStart: () => handlers.onDragStart(el.id),
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) =>
      handlers.onDragMove(el.id, event.target),
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => handlers.onDragEnd(el.id, event.target),
    onDblClick: () => handlers.onDoubleClick(el.id),
    onContextMenu: (event: Konva.KonvaEventObject<PointerEvent>) => {
      event.evt.preventDefault();
      handlers.onContextMenu(el.id, event.evt.clientX, event.evt.clientY);
    },
  };

  const t = transformProps(el, offset);
  const stroke = el.stroke
    ? { stroke: el.stroke.color, strokeWidth: el.stroke.width, dash: el.stroke.dash }
    : {};
  const w = el.width;
  const h = el.height;
  const paint = paintProps(el.fill, w, h);

  switch (el.shape) {
    case 'ellipse':
      return (
        <Ellipse
          {...shared}
          x={t.x}
          y={t.y}
          offsetX={0}
          offsetY={0}
          radiusX={w / 2}
          radiusY={h / 2}
          rotation={t.rotation}
          opacity={t.opacity}
          visible={t.visible}
          {...paint}
          {...stroke}
          {...shadowProps(el)}
        />
      );
    case 'ring':
      return (
        <Ring
          {...shared}
          x={t.x}
          y={t.y}
          offsetX={0}
          offsetY={0}
          innerRadius={(Math.min(w, h) / 2) * (el.innerRadiusRatio ?? 0.6)}
          outerRadius={Math.min(w, h) / 2}
          rotation={t.rotation}
          opacity={t.opacity}
          visible={t.visible}
          {...paint}
          {...stroke}
          {...shadowProps(el)}
        />
      );
    case 'triangle':
    case 'diamond':
    case 'pentagon':
    case 'hexagon':
      return (
        <RegularPolygon
          {...shared}
          x={t.x}
          y={t.y}
          offsetX={0}
          offsetY={0}
          sides={{ triangle: 3, diamond: 4, pentagon: 5, hexagon: 6 }[el.shape]}
          radius={Math.min(w, h) / 2}
          rotation={t.rotation}
          opacity={t.opacity}
          visible={t.visible}
          {...paint}
          {...stroke}
          {...shadowProps(el)}
        />
      );
    case 'star':
      return (
        <Star
          {...shared}
          x={t.x}
          y={t.y}
          offsetX={0}
          offsetY={0}
          numPoints={el.points ?? 5}
          outerRadius={Math.min(w, h) / 2}
          innerRadius={(Math.min(w, h) / 2) * (el.innerRadiusRatio ?? 0.45)}
          rotation={t.rotation}
          opacity={t.opacity}
          visible={t.visible}
          {...paint}
          {...stroke}
          {...shadowProps(el)}
        />
      );
    case 'arrow': {
      const color = el.stroke?.color ?? (typeof el.fill === 'string' ? el.fill : '#111111');
      return (
        <Arrow
          {...shared}
          {...t}
          points={[0, h / 2, w, h / 2]}
          stroke={color}
          strokeWidth={el.stroke?.width ?? 4}
          fill={color}
          pointerLength={Math.min(w, h) * 0.4}
          pointerWidth={Math.min(w, h) * 0.5}
          lineCap="round"
          {...shadowProps(el)}
        />
      );
    }
    case 'line':
      return (
        <Line
          {...shared}
          {...t}
          points={[0, 0, w, h]}
          stroke={el.stroke?.color ?? '#111111'}
          strokeWidth={el.stroke?.width ?? 2}
          lineCap="round"
          {...shadowProps(el)}
        />
      );
    case 'rect':
    case 'roundRect':
    default:
      return (
        <Rect
          {...shared}
          {...t}
          width={w}
          height={h}
          cornerRadius={el.shape === 'roundRect' ? el.cornerRadius ?? 24 : el.cornerRadius ?? 0}
          {...paint}
          {...stroke}
          {...shadowProps(el)}
        />
      );
  }
}

function TextNode({
  el,
  offset,
  register,
  interactive,
  ...handlers
}: NodeProps & { el: TextElement }) {
  const ref = useRef<Konva.Text>(null);
  useEffect(() => {
    register(el.id, ref.current);
    return () => register(el.id, null);
  }, [el.id, register]);

  return (
    <KonvaText
      id={el.id}
      ref={ref}
      {...transformProps(el, offset)}
      draggable={interactive && !el.locked}
      text={applyTextTransform(el.text, el)}
      fontFamily={el.fontFamily}
      fontSize={el.fontSize}
      fontStyle={
        [el.fontStyle === 'italic' ? 'italic' : '', el.fontWeight >= 600 ? 'bold' : '']
          .filter(Boolean)
          .join(' ') || 'normal'
      }
      textDecoration={el.textDecoration ?? 'none'}
      align={el.align}
      verticalAlign={el.verticalAlign}
      lineHeight={el.lineHeight}
      letterSpacing={el.letterSpacing}
      padding={el.padding ?? 0}
      width={el.width}
      height={el.height}
      fill={el.color}
      wrap="word"
      {...shadowProps(el)}
      onMouseEnter={() => handlers.onHover(el.id)}
      onMouseLeave={() => handlers.onHover(null)}
      onMouseDown={(event: Konva.KonvaEventObject<MouseEvent>) => {
        event.cancelBubble = true;
        handlers.onSelect(el.id, event.evt.shiftKey || event.evt.metaKey);
      }}
      onDragStart={() => handlers.onDragStart(el.id)}
      onDragMove={(event: Konva.KonvaEventObject<DragEvent>) =>
        handlers.onDragMove(el.id, event.target)
      }
      onDragEnd={(event: Konva.KonvaEventObject<DragEvent>) =>
        handlers.onDragEnd(el.id, event.target)
      }
      onDblClick={() => handlers.onDoubleClick(el.id)}
      onContextMenu={(event: Konva.KonvaEventObject<PointerEvent>) => {
        event.evt.preventDefault();
        handlers.onContextMenu(el.id, event.evt.clientX, event.evt.clientY);
      }}
    />
  );
}

function LineNode({
  el,
  offset,
  register,
  interactive,
  ...handlers
}: NodeProps & { el: LineElement }) {
  const ref = useRef<Konva.Line>(null);
  useEffect(() => {
    register(el.id, ref.current);
    return () => register(el.id, null);
  }, [el.id, register]);

  return (
    <Line
      id={el.id}
      ref={ref}
      {...transformProps(el, offset)}
      draggable={interactive && !el.locked}
      points={el.points}
      stroke={el.stroke.color}
      strokeWidth={el.stroke.width}
      dash={el.stroke.dash}
      lineCap={el.lineCap ?? 'round'}
      tension={el.tension ?? 0}
      closed={el.closed ?? false}
      {...shadowProps(el)}
      onMouseEnter={() => handlers.onHover(el.id)}
      onMouseLeave={() => handlers.onHover(null)}
      onMouseDown={(event: Konva.KonvaEventObject<MouseEvent>) => {
        event.cancelBubble = true;
        handlers.onSelect(el.id, event.evt.shiftKey || event.evt.metaKey);
      }}
      onDragStart={() => handlers.onDragStart(el.id)}
      onDragMove={(event: Konva.KonvaEventObject<DragEvent>) =>
        handlers.onDragMove(el.id, event.target)
      }
      onDragEnd={(event: Konva.KonvaEventObject<DragEvent>) =>
        handlers.onDragEnd(el.id, event.target)
      }
    />
  );
}

function GroupNode({ el, ...rest }: NodeProps & { el: GroupElement }) {
  const { offset, images } = rest;
  const childOffset = { dx: offset.dx + el.x, dy: offset.dy + el.y };
  return (
    <KonvaGroup
      id={el.id}
      {...transformProps(el, offset)}
      draggable={rest.interactive && !el.locked}
      onMouseEnter={() => rest.onHover(el.id)}
      onMouseLeave={() => rest.onHover(null)}
      onMouseDown={(event: Konva.KonvaEventObject<MouseEvent>) => {
        event.cancelBubble = true;
        rest.onSelect(el.id, event.evt.shiftKey || event.evt.metaKey);
      }}
      onDragStart={() => rest.onDragStart(el.id)}
      onDragMove={(event: Konva.KonvaEventObject<DragEvent>) =>
        rest.onDragMove(el.id, event.target)
      }
      onDragEnd={(event: Konva.KonvaEventObject<DragEvent>) =>
        rest.onDragEnd(el.id, event.target)
      }
      onContextMenu={(event: Konva.KonvaEventObject<PointerEvent>) => {
        event.evt.preventDefault();
        rest.onContextMenu(el.id, event.evt.clientX, event.evt.clientY);
      }}
    >
      {el.children
        .slice()
        .sort((a, b) => a.z - b.z)
        .map((child) => (
          <ElementNode
            key={child.id}
            {...rest}
            offset={childOffset}
            images={images}
            element={child}
          />
        ))}
    </KonvaGroup>
  );
}

function ElementNode(props: NodeProps) {
  const { element } = props;
  if (element.hidden) return null;
  switch (element.type) {
    case 'text':
      return <TextNode {...props} el={element} />;
    case 'image':
      return <ImageNode {...props} el={element} />;
    case 'shape':
      return <ShapeNode {...props} el={element} />;
    case 'line':
      return <LineNode {...props} el={element} />;
    case 'group':
      return <GroupNode {...props} el={element} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

function Guides({ guides }: { guides: { orientation: 'v' | 'h'; position: number; from: number; to: number }[] }) {
  return (
    <>
      {guides.map((guide, index) =>
        guide.orientation === 'v' ? (
          <Line
            key={`gv${index}`}
            points={[guide.position, guide.from - 40, guide.position, guide.to + 40]}
            stroke="#ec4899"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ) : (
          <Line
            key={`gh${index}`}
            points={[guide.from - 40, guide.position, guide.to + 40, guide.position]}
            stroke="#ec4899"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ),
      )}
    </>
  );
}

function GridOverlay({ width, height, step = 50 }: { width: number; height: number; step?: number }) {
  const lines: React.ReactElement[] = [];
  for (let x = step; x < width; x += step) {
    lines.push(
      <Line key={`gx${x}`} points={[x, 0, x, height]} stroke="#94a3b8" strokeWidth={0.5} opacity={0.35} listening={false} />,
    );
  }
  for (let y = step; y < height; y += step) {
    lines.push(
      <Line key={`gy${y}`} points={[0, y, width, y]} stroke="#94a3b8" strokeWidth={0.5} opacity={0.35} listening={false} />,
    );
  }
  return <>{lines}</>;
}

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

const FIT_PADDING = 64;

export function EditorCanvas() {
  const container = useElementSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const panState = useRef<{ active: boolean; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);

  const document = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const cropTargetId = useEditorStore((s) => s.cropTargetId);

  const zoom = useUIStore((s) => s.zoom);
  const zoomMode = useUIStore((s) => s.zoomMode);
  const pan = useUIStore((s) => s.pan);
  const snapEnabled = useUIStore((s) => s.snapEnabled);
  const gridVisible = useUIStore((s) => s.gridVisible);
  const rulersVisible = useUIStore((s) => s.rulersVisible);
  const setGuides = useEditorStore((s) => s.setGuides);

  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const sources = useMemo(() => collectImageSources(document), [document]);
  const images = useImageMap(sources);

  /* ---- fit-to-view ------------------------------------------- */
  const fitScale = useMemo(() => {
    if (!container.width || !container.height) return 1;
    return Math.min(
      (container.width - FIT_PADDING) / document.width,
      (container.height - FIT_PADDING) / document.height,
    );
  }, [container.width, container.height, document.width, document.height]);

  const scale = zoomMode === 'fit' ? fitScale : zoom;

  const offset = useMemo(() => {
    const baseX = (container.width - document.width * scale) / 2;
    const baseY = (container.height - document.height * scale) / 2;
    return { x: baseX + pan.x, y: baseY + pan.y };
  }, [container.width, container.height, document.width, document.height, scale, pan.x, pan.y]);

  /* ---- transformer wiring ------------------------------------ */
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const targets = selection
      .map((id) => nodes.current.get(id))
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(targets);
    transformer.getLayer()?.batchDraw();
  }, [selection, document]);

  const register = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  /* ---- interaction handlers ---------------------------------- */

  const handleSelect = useCallback(
    (id: string, additive: boolean) => {
      setContextMenu(null);
      useEditorStore.getState().select([id], additive);
    },
    [],
  );

  const handleDragStart = useCallback((id: string) => {
    const store = useEditorStore.getState();
    store.beginInteraction();
    const el = findElement(store.document.elements, id);
    dragOrigin.current = el ? { x: el.x, y: el.y } : null;
  }, []);

  const handleDragMove = useCallback(
    (id: string, node: Konva.Node) => {
      if (!snapEnabled) return;
      const store = useEditorStore.getState();
      const el = findElement(store.document.elements, id);
      if (!el) return;

      const box = {
        x: node.x() - el.width / 2,
        y: node.y() - el.height / 2,
        width: el.width,
        height: el.height,
      };
      const others = flatten(store.document.elements).filter(
        (other) => other.id !== id && !other.hidden && other.type !== 'group',
      );
      const { dx, dy, guides } = computeSnap(
        box,
        others,
        { width: store.document.width, height: store.document.height },
        useUIStore.getState().snapThreshold / scale,
      );
      if (dx || dy) node.position({ x: node.x() + dx, y: node.y() + dy });
      setGuides(guides);
    },
    [snapEnabled, scale, setGuides],
  );

  const handleDragEnd = useCallback(
    (id: string, node: Konva.Node) => {
      const store = useEditorStore.getState();
      const el = findElement(store.document.elements, id);
      if (!el) return;
      const nextX = node.x() - el.width / 2;
      const nextY = node.y() - el.height / 2;
      const dx = nextX - el.x;
      const dy = nextY - el.y;
      if (dx || dy) store.move([id], dx, dy, undefined);
      store.endInteraction('Move');
      dragOrigin.current = null;
      setGuides([]);
    },
    [setGuides],
  );

  const handleTransformEnd = useCallback(() => {
    const store = useEditorStore.getState();
    for (const id of store.selection) {
      const node = nodes.current.get(id);
      const el = findElement(store.document.elements, id);
      if (!node || !el) continue;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);

      store.transform(id, {
        x: node.x() - (el.width * scaleX) / 2,
        y: node.y() - (el.height * scaleY) / 2,
        width: Math.max(4, el.width * scaleX),
        height: Math.max(4, el.height * scaleY),
        rotation: node.rotation(),
      });
    }
    store.endInteraction('Transform');
  }, []);

  const handleDoubleClick = useCallback((id: string) => {
    const store = useEditorStore.getState();
    const el = findElement(store.document.elements, id);
    if (!el) return;
    if (el.type === 'text') store.beginTextEdit(id);
    else if (el.type === 'image') store.beginCrop(id);
  }, []);

  /* ---- panning on empty canvas ------------------------------- */
  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    setContextMenu(null);
    const isBackground = event.target === event.target.getStage();
    if (isBackground) {
      useEditorStore.getState().clearSelection();
      panState.current = {
        active: true,
        startX: event.evt.clientX,
        startY: event.evt.clientY,
        originX: pan.x,
        originY: pan.y,
      };
    }
  };

  const handleStageMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const state = panState.current;
    if (!state?.active) return;
    const ui = useUIStore.getState();
    ui.setPan({
      x: state.originX + (event.evt.clientX - state.startX),
      y: state.originY + (event.evt.clientY - state.startY),
    });
  };

  const handleStageMouseUp = () => {
    panState.current = null;
  };

  /* ---- wheel zoom -------------------------------------------- */
  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    if (!event.evt.ctrlKey && !event.evt.metaKey) return;
    event.evt.preventDefault();
    const ui = useUIStore.getState();
    const factor = event.evt.deltaY < 0 ? 1.08 : 1 / 1.08;
    ui.setZoom(ui.zoom * factor, 'manual');
  };

  /* ---- inline text editor ------------------------------------ */
  const editingElement = editingTextId
    ? (findElement(document.elements, editingTextId) as TextElement | undefined)
    : undefined;

  const editingStyle = editingElement
    ? {
        left: offset.x + editingElement.x * scale,
        top: offset.y + editingElement.y * scale,
        width: editingElement.width * scale,
        height: editingElement.height * scale,
        fontFamily: editingElement.fontFamily,
        fontSize: editingElement.fontSize * scale,
        fontWeight: editingElement.fontWeight,
        fontStyle: editingElement.fontStyle ?? 'normal',
        lineHeight: editingElement.lineHeight,
        letterSpacing: editingElement.letterSpacing * scale,
        color: editingElement.color,
        textAlign: editingElement.align,
        opacity: editingElement.opacity,
      }
    : undefined;

  const sorted = useMemo(
    () => document.elements.slice().sort((a, b) => a.z - b.z),
    [document.elements],
  );

  return (
    <div
      ref={container.ref}
      className="relative size-full overflow-hidden bg-canvas"
      onContextMenu={(event) => event.preventDefault()}
    >
      {rulersVisible && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-5 w-full border-b border-line bg-surface/90 backdrop-blur">
            <RulerTicks
              orientation="horizontal"
              length={container.width}
              scale={scale}
              offset={offset.x}
              total={document.width}
            />
          </div>
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-5 border-r border-line bg-surface/90 backdrop-blur">
            <RulerTicks
              orientation="vertical"
              length={container.height}
              scale={scale}
              offset={offset.y}
              total={document.height}
            />
          </div>
        </>
      )}

      {container.width > 0 && (
        <Stage
          ref={stageRef}
          width={container.width}
          height={container.height}
          scaleX={scale}
          scaleY={scale}
          x={offset.x}
          y={offset.y}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onWheel={handleWheel}
          style={{ cursor: panState.current?.active ? 'grabbing' : 'default' }}
        >
          <Layer>
            {/* canvas surface + shadow */}
            <Rect
              x={0}
              y={0}
              width={document.width}
              height={document.height}
              listening={false}
              shadowColor="#000000"
              shadowBlur={24}
              shadowOpacity={0.18}
              shadowOffsetY={6}
              {...paintProps(
                document.background,
                document.width,
                document.height,
              )}
            />

            {gridVisible && <GridOverlay width={document.width} height={document.height} />}

            {sorted.map((element) => (
              <ElementNode
                key={element.id}
                element={element}
                offset={{ dx: 0, dy: 0 }}
                images={images}
                register={register}
                interactive={!cropTargetId}
                onSelect={handleSelect}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onDoubleClick={handleDoubleClick}
                onContextMenu={(id, x, y) => setContextMenu({ id, x, y })}
                hoveredId={null}
                onHover={() => undefined}
              />
            ))}

            {/* selection outline for elements the transformer cannot handle */}
            {selection.map((id) => {
              const el = findElement(document.elements, id);
              if (!el || el.hidden) return null;
              return (
                <Rect
                  key={`outline-${id}`}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  rotation={el.rotation}
                  offsetX={0}
                  offsetY={0}
                  listening={false}
                  stroke="#4f46e5"
                  strokeWidth={1 / scale}
                  dash={el.locked ? [6 / scale, 4 / scale] : undefined}
                  fillEnabled={false}
                  opacity={el.locked ? 0.55 : 1}
                />
              );
            })}

            <Guides guides={useEditorStore.getState().guides} />

            <Transformer
              ref={transformerRef}
              rotateEnabled
              flipEnabled={false}
              keepRatio={false}
              ignoreStroke
              borderStroke="#4f46e5"
              borderStrokeWidth={1.5}
              anchorStroke="#4f46e5"
              anchorFill="#ffffff"
              anchorSize={9}
              anchorCornerRadius={2}
              rotateAnchorOffset={26}
              padding={2}
              onTransformEnd={handleTransformEnd}
              onTransformStart={() => useEditorStore.getState().beginInteraction()}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 6 || newBox.height < 6 ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      )}

      {/* inline text editor overlay */}
      {editingElement && editingStyle && (
        <textarea
          autoFocus
          defaultValue={editingElement.text}
          style={editingStyle}
          className="absolute z-20 resize-none overflow-hidden border-2 border-brand bg-transparent p-0 outline-none"
          onBlur={(event) => {
            const store = useEditorStore.getState();
            store.setText(editingElement.id, event.target.value);
            store.endTextEdit();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              useEditorStore.getState().endTextEdit();
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              (event.target as HTMLTextAreaElement).blur();
            }
            event.stopPropagation();
          }}
          onChange={(event) => {
            // Live update so the canvas and the field never disagree on commit.
            useEditorStore.getState().setText(editingElement.id, event.target.value, `live-text:${editingElement.id}`);
          }}
        />
      )}

      {/* lightweight element context menu */}
      {contextMenu && (
        <ElementContextMenu
          id={contextMenu.id}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      {!document.elements.length && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
          <div className="rounded-full border border-line bg-surface/95 px-4 py-2 text-xs text-ink-soft shadow-[var(--shadow-panel)]">
            Empty canvas — press <kbd className="font-mono text-ink">T</kbd> for text,{' '}
            <kbd className="font-mono text-ink">R</kbd> for a rectangle, or pick a template.
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RulerTicks({
  orientation,
  length,
  scale,
  offset,
  total,
}: {
  orientation: 'horizontal' | 'vertical';
  length: number;
  scale: number;
  offset: number;
  total: number;
}) {
  const step = 100;
  const ticks: React.ReactElement[] = [];
  const count = Math.ceil(total / step) + 1;

  for (let i = 0; i < count; i += 1) {
    const designPos = i * step;
    const screen = offset + designPos * scale;
    if (screen < 0 || screen > length) continue;
    ticks.push(
      orientation === 'horizontal' ? (
        <div
          key={i}
          className="absolute top-0 h-full border-l border-line-strong/70 pl-1 font-mono text-[9px] leading-5 text-ink-muted"
          style={{ left: screen }}
        >
          {designPos}
        </div>
      ) : (
        <div
          key={i}
          className="absolute left-0 w-full border-t border-line-strong/70 pt-1 font-mono text-[9px] text-ink-muted"
          style={{ top: screen, writingMode: 'vertical-rl' }}
        >
          {designPos}
        </div>
      ),
    );
  }
  return <>{ticks}</>;
}

function ElementContextMenu({
  id,
  x,
  y,
  onClose,
}: {
  id: string;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const store = useEditorStore;
  const element = store((s) => findElement(s.document.elements, id));
  const selection = store((s) => s.selection);

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  if (!element) return null;
  const actions = store.getState();

  const items: { label: string; run: () => void; danger?: boolean }[] = [
    { label: 'Duplicate', run: () => actions.duplicate([id]) },
    {
      label: element.locked ? 'Unlock' : 'Lock',
      run: () => actions.toggleLock(id),
    },
    {
      label: element.hidden ? 'Show' : 'Hide',
      run: () => actions.toggleHidden(id),
    },
    { label: 'Bring to front', run: () => actions.reorder(id, 'front') },
    { label: 'Send to back', run: () => actions.reorder(id, 'back') },
  ];

  if (selection.length > 1) {
    items.push({ label: `Group ${selection.length} layers`, run: () => actions.group() });
  }
  if (element.type === 'group') {
    items.push({ label: 'Ungroup', run: () => actions.ungroup(id) });
  }
  if (element.type === 'image') {
    items.push({ label: 'Crop image', run: () => actions.beginCrop(id) });
  }
  items.push({ label: 'Delete', run: () => actions.remove([id]), danger: true });

  return (
    <div
      className="fixed z-50 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-float)]"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => {
            item.run();
            onClose();
          }}
          className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-3 ${
            item.danger ? 'text-danger hover:bg-danger/10' : 'text-ink'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
