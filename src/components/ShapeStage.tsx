import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';

import { ShapeRenderer, variantCount, type Rect } from '../lib/shapeRenderer';

// HTML-in-Canvas (https://github.com/WICG/html-in-canvas) APIs, not yet in lib.dom.d.ts.
type DrawableCanvas = HTMLCanvasElement & {
	onpaint: ((event: Event & { changedElements: readonly Element[] }) => void) | null;
	requestPaint(): void;
	getElementImageDefaultSize(element: Element): { width: number; height: number };
	updateElementGeometry(element: Element, options: { canvasTransform: DOMMatrixInit }): void;
};
type DrawableGL = WebGL2RenderingContext & {
	texElementSubImage2D(
		target: number,
		level: number,
		xoffset: number,
		yoffset: number,
		element: Element,
	): void;
};

export function supportsShapeStage(): boolean {
	return (
		typeof window !== 'undefined' &&
		'requestPaint' in HTMLCanvasElement.prototype &&
		'getElementImageDefaultSize' in HTMLCanvasElement.prototype &&
		typeof WebGL2RenderingContext !== 'undefined' &&
		'texElementSubImage2D' in WebGL2RenderingContext.prototype &&
		!window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

const morphDuration = 1800;
const headerHeight = 60; // Keep in sync with the header height in Layout.astro.

type Slot = { texture: WebGLTexture; rect: Rect; key: string | null };

type Props = {
	noteKey: string;
	children: ReactNode;
	containerRef?: Ref<HTMLDivElement>;
	onUnsupported: () => void;
};

export default function ShapeStage({ noteKey, children, containerRef, onUnsupported }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const drawableRef = useRef<HTMLDivElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const [stage, setStage] = useState({ w: 0, h: 0 });
	const stageRef = useRef(stage);
	stageRef.current = stage;

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const observer = new ResizeObserver(([entry]) => {
			const device = entry.devicePixelContentBoxSize?.[0];
			const css = entry.contentBoxSize[0];
			canvas.width = Math.round(device?.inlineSize ?? css.inlineSize * devicePixelRatio);
			canvas.height = Math.round(device?.blockSize ?? css.blockSize * devicePixelRatio);
			setStage({ w: css.inlineSize, h: css.blockSize });
			(canvas as DrawableCanvas).requestPaint();
		});
		observer.observe(canvas, { box: 'device-pixel-content-box' });
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current as DrawableCanvas | null;
		const gl = canvas?.getContext('webgl2', { premultipliedAlpha: true }) as DrawableGL | null;
		if (!canvas || !gl) {
			onUnsupported();
			return;
		}

		let renderer: ShapeRenderer | null = null;
		let current: Slot = { texture: null!, rect: { x: 0, y: 0, w: 0, h: 0 }, key: null };
		let previous: Slot | null = null;
		let spare: WebGLTexture = null!;
		let transitionStart = -Infinity;
		let variant = 0;
		let seed = 0;
		let needsUpload = true;

		const setup = (): boolean => {
			try {
				renderer = new ShapeRenderer(gl);
			} catch (error) {
				console.error(error);
				return false;
			}
			current.texture = renderer.createTexture();
			spare = renderer.createTexture();
			previous = null;
			needsUpload = true;
			return true;
		};
		if (!setup()) {
			onUnsupported();
			return;
		}

		const measureCard = (drawable: HTMLElement): Rect => {
			const card = cardRef.current?.firstElementChild ?? cardRef.current;
			if (!card) return { x: 0, y: 0, w: 0, h: 0 };
			const base = drawable.getBoundingClientRect();
			const r = card.getBoundingClientRect();
			return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
		};

		const upload = (slot: Slot, drawable: HTMLElement) => {
			const { width, height } = canvas.getElementImageDefaultSize(drawable);
			gl.bindTexture(gl.TEXTURE_2D, slot.texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, drawable);
			slot.rect = measureCard(drawable);
		};

		canvas.onpaint = (event) => {
			const drawable = drawableRef.current;
			const size = stageRef.current;
			if (!renderer || !drawable || size.w === 0) return;
			const now = performance.now();

			if (event.changedElements.includes(drawable) || needsUpload) {
				const key = drawable.dataset.key ?? null;
				if (key !== current.key) {
					if (current.key !== null) {
						// Keep the outgoing note's texture so its pieces can fly over.
						const outgoing = current;
						previous = outgoing;
						current = { texture: spare, rect: outgoing.rect, key };
						spare = outgoing.texture;
					} else {
						previous = null;
						current.key = key;
					}
					transitionStart = now;
					// A different way of scattering from the last one.
					variant = (variant + 1 + Math.floor(Math.random() * (variantCount - 1))) % variantCount;
					seed = Math.floor(Math.random() * 2 ** 32);
				}
				upload(current, drawable);
				needsUpload = false;
				canvas.updateElementGeometry(drawable, { canvasTransform: new DOMMatrix() });
			}

			const elapsed = now - transitionStart;
			renderer.clear();
			if (elapsed < morphDuration) {
				renderer.drawMorph(previous, current, size, elapsed / morphDuration, variant, seed);
				canvas.requestPaint();
			} else {
				previous = null;
				renderer.drawWhole(current.texture);
			}
		};

		// GPU resets can drop the context; rebuild everything once it comes back.
		const onContextLost = (event: Event) => {
			event.preventDefault();
			renderer = null;
		};
		const onContextRestored = () => {
			if (setup()) {
				transitionStart = -Infinity;
				canvas.requestPaint();
			} else {
				onUnsupported();
			}
		};
		canvas.addEventListener('webglcontextlost', onContextLost);
		canvas.addEventListener('webglcontextrestored', onContextRestored);
		canvas.requestPaint();

		return () => {
			canvas.onpaint = null;
			canvas.removeEventListener('webglcontextlost', onContextLost);
			canvas.removeEventListener('webglcontextrestored', onContextRestored);
		};
	}, [onUnsupported]);

	return (
		<canvas
			ref={canvasRef}
			{...{ content: 'drawable' }}
			className="pointer-events-none fixed left-0 w-full"
			style={{ top: headerHeight, height: `calc(100dvh - ${headerHeight}px)` }}
		>
			<div
				ref={drawableRef}
				{...{ drawable: '' }}
				data-key={noteKey}
				className="flex items-center justify-center p-5"
				style={{ width: stage.w, height: stage.h }}
			>
				<div
					ref={(element) => {
						cardRef.current = element;
						if (typeof containerRef === 'function') containerRef(element);
						else if (containerRef) containerRef.current = element;
					}}
					className="w-11/12 lg:w-2/3"
				>
					{children}
				</div>
			</div>
		</canvas>
	);
}
