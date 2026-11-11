// WebGL2 renderer that breaks card textures into grid cells and animates the
// cells as the four Nostrasia shapes (circle / triangle / square / dome).
//
// drawMorph flies the cells of the outgoing card over and lands them as the
// cells of the incoming card. With no outgoing card, the cells start as
// shapes strewn about the stage instead.

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

// Ways the pieces scatter between cards: cloud, vortex, drop, implode,
// explode, wind, logo, columns, rays, galaxy, target, line.
export const variantCount = 12;

const common = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in float aTarget;

uniform vec2 uStage;

out vec2 vCorner;
out vec2 vUvA;
out vec2 vUvB;
out float vMorph;
out float vUseB;
out float vAlpha;
flat out int vShape;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void cellAt(int index, vec4 rect, float cell, int cols, out vec2 cr, out vec2 center, out vec2 size) {
	cr = vec2(float(index % cols), float(index / cols));
	vec2 origin = rect.xy + cr * cell;
	size = min(vec2(cell), rect.xy + rect.zw - origin);
	center = origin + size * 0.5;
}

// Peel order: a sweep from the top-left with some jitter.
float sweep(vec2 cr, int cols, int rows) {
	return clamp(cr.x / float(cols) * 0.6 + cr.y / float(rows) * 0.25 + hash(cr + 5.7) * 0.15, 0.0, 1.0);
}

void emit(vec2 center, vec2 size, float scale, float rot) {
	float c = cos(rot);
	float s = sin(rot);
	vec2 pos = center + mat2(c, s, -s, c) * (aCorner * size * scale);
	vec2 clip = pos / uStage * 2.0 - 1.0;
	gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
	vCorner = aCorner;
}
`;

const morphVs = `${common}
uniform vec4 uRectA;
uniform vec4 uRectB;
uniform float uCellA;
uniform float uCellB;
uniform ivec2 uGridA;
uniform ivec2 uGridB;
uniform float uT;
uniform float uIntro;
uniform int uVariant;

void main() {
	int countA = uGridA.x * uGridA.y;
	int countB = uGridB.x * uGridB.y;
	// i covers every outgoing cell; aTarget is a shuffled permutation, so k
	// covers every incoming cell and the pairs are uncorrelated.
	int i = gl_InstanceID;
	int k = int(aTarget);

	vec2 crA, centerA, sizeA, crB, centerB, sizeB;
	cellAt(i % countA, uRectA, uCellA, uGridA.x, crA, centerA, sizeA);
	cellAt(k % countB, uRectB, uCellB, uGridB.x, crB, centerB, sizeB);

	float start = sweep(crA, uGridA.x, uGridA.y) * 0.3;
	if (uIntro > 0.5) {
		centerA = vec2(hash(crB + 17.3), hash(crB + 41.7)) * uStage;
		sizeA = sizeB;
		crA = crB;
		start = hash(crB + 5.7) * 0.3;
	}
	float end = 0.7 + sweep(crB, uGridB.x, uGridB.y) * 0.3;
	float u = clamp((uT - start) / (end - start), 0.0, 1.0);
	float e = u * u * (3.0 - 2.0 * u);

	// Each variant picks the point the piece passes through halfway; the
	// quadratic curve's control point is set so that it does.
	vec2 mid = (centerA + centerB) * 0.5;
	vec2 stageCenter = uStage * 0.5;
	float span = max(uStage.x, uStage.y);
	float h = hash(crB + 17.3);
	float h2 = hash(crA + 41.7);
	float ang = (h * 2.0 - 1.0) * 3.14159;
	vec2 dir = vec2(cos(ang), sin(ang));
	float spin = 5.0;
	int shape = int(floor(hash(crB + 91.9) * 4.0));
	float h3 = hash(crB + 7.7);
	float h4 = hash(crB + 13.1);
	float minSide = min(uStage.x, uStage.y);
	vec2 halfway;
	if (uVariant == 1) {
		// Vortex: swirl into a ring around the middle of the stage.
		vec2 r = centerA - stageCenter;
		float a = atan(r.y, r.x) + 2.0 + h * 0.8;
		halfway = stageCenter + vec2(cos(a), sin(a)) * mix(0.22, 0.34, h2) * min(uStage.x, uStage.y);
		spin = 8.0;
	} else if (uVariant == 2) {
		// Drop: fall into a pile at the bottom, then fly back up.
		halfway = vec2(mix(centerA.x, centerB.x, 0.5) + (h - 0.5) * 0.2 * uStage.x,
			uStage.y - pow(h2, 2.0) * 0.18 * uStage.y - uCellB);
		spin = 3.0;
	} else if (uVariant == 3) {
		// Implode: squeeze into a ball in the middle, then burst.
		halfway = stageCenter + dir * pow(h2, 0.7) * 0.07 * span;
		spin = 7.0;
	} else if (uVariant == 4) {
		// Explode: blow outward from the middle of the stage.
		halfway = stageCenter + (centerA - stageCenter) * mix(1.4, 1.9, h2) + dir * 0.03 * span;
	} else if (uVariant == 5) {
		// Wind: get blown off to the side in a wavy stream.
		halfway = vec2(mid.x + mix(0.25, 0.55, h2) * uStage.x,
			mid.y + sin(centerA.x * 0.02 + h * 6.28) * 0.08 * uStage.y);
		spin = 4.0;
	} else if (uVariant == 6) {
		// Logo: gather into a big Nostrasia mark, each piece in its own shape.
		// Coordinates follow the 30x30 mark in the header.
		vec2 m;
		if (shape == 0) {
			float a = h4 * 6.28318;
			m = vec2(9.0) + sqrt(h3) * 8.0 * vec2(cos(a), sin(a));
		} else if (shape == 1) {
			vec2 b = h3 + h4 > 1.0 ? vec2(1.0 - h3, 1.0 - h4) : vec2(h3, h4);
			m = vec2(22.0, 2.0) + b.x * vec2(-7.0, 13.0) + b.y * vec2(7.0, 13.0);
		} else if (shape == 2) {
			m = vec2(2.0, 18.0) + vec2(h3, h4) * 10.0;
		} else {
			float a = 3.14159 + h4 * 3.14159;
			m = vec2(23.0, 28.0) + sqrt(h3) * 7.0 * vec2(cos(a), sin(a));
		}
		float side = 0.8 * minSide;
		halfway = stageCenter + (m / 30.0 - 0.5) * side;
		spin = 3.0;
	} else if (uVariant == 7) {
		// Columns: line up in one column per shape.
		halfway = vec2((0.2 + 0.2 * float(shape)) * uStage.x + (h3 - 0.5) * 0.06 * uStage.x,
			mix(0.12, 0.88, h4) * uStage.y);
		spin = 2.0;
	} else if (uVariant == 8) {
		// Rays: line up along twelve rays out from the middle, like a sunburst.
		float a = floor(h3 * 12.0) / 12.0 * 6.28318 + (h4 - 0.5) * 0.06;
		float r = mix(0.08, 0.48, sqrt(h2)) * minSide;
		halfway = stageCenter + r * vec2(cos(a), sin(a));
		spin = 3.0;
	} else if (uVariant == 9) {
		// Galaxy: settle along two spiral arms.
		float r = sqrt(h3);
		float a = r * 7.0 + float(shape % 2) * 3.14159 + (h4 - 0.5) * 0.5;
		halfway = stageCenter + r * 0.45 * minSide * vec2(cos(a), sin(a));
		spin = 6.0;
	} else if (uVariant == 10) {
		// Target: one ring per shape, purple in the middle out to teal.
		float r = (0.1 + 0.11 * float(shape) + (h4 - 0.5) * 0.06) * minSide;
		float a = h3 * 6.28318;
		halfway = stageCenter + r * vec2(cos(a), sin(a));
		spin = 4.0;
	} else if (uVariant == 11) {
		// Line: stream through a thin band across the middle.
		halfway = vec2(mix(0.03, 0.97, h3) * uStage.x, stageCenter.y + (h4 - 0.5) * 0.05 * uStage.y);
		spin = 2.0;
	} else {
		// Cloud: drift off in random directions.
		halfway = mid + dir * mix(0.04, 0.18, h2) * span;
	}
	vec2 control = 2.0 * halfway - mid;
	vec2 center = (1.0 - e) * (1.0 - e) * centerA + 2.0 * (1.0 - e) * e * control + e * e * centerB;
	if (uVariant == 2) {
		center.y = min(center.y, uStage.y - uCellB * 0.5);
	}

	float lift = sin(3.14159 * e);
	float rot = lift * (hash(crB + 3.1) * 2.0 - 1.0) * spin;
	float scale = 1.0 - 0.1 * lift;

	emit(center, mix(sizeA, sizeB, e), scale, rot);
	vUvA = (centerA + aCorner * sizeA) / uStage;
	vUvB = (centerB + aCorner * sizeB) / uStage;
	vUseB = step(0.5, u);
	float land = 1.0 - smoothstep(0.85, 1.0, u);
	vMorph = uIntro > 0.5 ? land : smoothstep(0.0, 0.15, u) * land;
	// Strewn shapes pop in when their flight starts.
	vAlpha = uIntro > 0.5 ? step(0.001, u) : 1.0;
	vShape = shape;
}
`;

const pieceFs = `#version 300 es
precision highp float;

uniform sampler2D uTexA;
uniform sampler2D uTexB;

in vec2 vCorner;
in vec2 vUvA;
in vec2 vUvB;
in float vMorph;
in float vUseB;
in float vAlpha;
flat in int vShape;

out vec4 outColor;

const vec3 PALETTE[4] = vec3[4](
	vec3(0.557, 0.188, 0.922), // circle: purple
	vec3(0.949, 0.329, 0.176), // triangle: orange
	vec3(0.965, 0.765, 0.141), // square: yellow
	vec3(0.055, 0.486, 0.482)  // dome: teal
);

float shapeMask(int k, vec2 q) {
	const float aa = 0.03;
	if (k == 0) {
		return 1.0 - smoothstep(0.42 - aa, 0.42, length(q));
	}
	if (k == 1) {
		float halfWidth = (q.y + 0.42) / 0.82 * 0.46;
		float sides = 1.0 - smoothstep(halfWidth - aa, halfWidth, abs(q.x));
		float base = 1.0 - smoothstep(0.40 - aa, 0.40, q.y);
		return sides * base * step(-0.42, q.y);
	}
	if (k == 2) {
		return 1.0 - smoothstep(0.36 - aa, 0.36, max(abs(q.x), abs(q.y)));
	}
	float dome = 1.0 - smoothstep(0.44 - aa, 0.44, length(q - vec2(0.0, 0.22)));
	return dome * (1.0 - smoothstep(0.22 - aa, 0.22, q.y));
}

void main() {
	float shape = shapeMask(vShape, vCorner);
	vec4 shapeColor = vec4(PALETTE[vShape], 1.0);
	vec4 tex = vUseB > 0.5 ? texture(uTexB, vUvB) : texture(uTexA, vUvA);
	vec4 color = mix(tex, shapeColor, vMorph);
	float a = color.a * mix(1.0, shape, vMorph) * vAlpha;
	outColor = vec4(color.rgb * a, a);
}
`;

const blitVs = `#version 300 es
out vec2 vUv;
void main() {
	vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
	vUv = p;
	gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}
`;

const blitFs = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 outColor;
void main() {
	vec4 tex = texture(uTex, vUv);
	outColor = vec4(tex.rgb * tex.a, tex.a);
}
`;

type Program = { program: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

function compile(gl: WebGL2RenderingContext, vs: string, fs: string, names: string[]): Program {
	const program = gl.createProgram();
	for (const [type, source] of [
		[gl.VERTEX_SHADER, vs],
		[gl.FRAGMENT_SHADER, fs],
	] as const) {
		const shader = gl.createShader(type)!;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
		}
		gl.attachShader(program, shader);
	}
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed');
	}
	return {
		program,
		u: Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])),
	};
}

// Extra area to the bottom-right of the card so its offset shadow breaks apart too.
const shadowPad = 8;

type Grid = { rect: Rect; cell: number; cols: number; rows: number };

function grid(card: Rect, stage: Size): Grid {
	const rect = { ...card, w: card.w + shadowPad, h: card.h + shadowPad };
	const cell = Math.min(28, Math.max(14, stage.w / 60));
	return { rect, cell, cols: Math.ceil(rect.w / cell), rows: Math.ceil(rect.h / cell) };
}

// Fisher-Yates shuffle of 0..count-1 driven by a seeded PRNG (mulberry32).
function permutation(count: number, seed: number): Float32Array {
	let state = seed >>> 0;
	const random = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let x = state;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
	const order = new Float32Array(count);
	for (let i = 0; i < count; i++) order[i] = i;
	for (let i = count - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	return order;
}

export class ShapeRenderer {
	private gl: WebGL2RenderingContext;
	private morph: Program;
	private blit: Program;
	private vao: WebGLVertexArrayObject;
	private targets: WebGLBuffer;
	private targetsKey = '';

	constructor(gl: WebGL2RenderingContext) {
		this.gl = gl;
		const shared = ['uStage', 'uTexA', 'uTexB'];
		this.morph = compile(gl, morphVs, pieceFs, [
			...shared,
			'uRectA',
			'uRectB',
			'uCellA',
			'uCellB',
			'uGridA',
			'uGridB',
			'uT',
			'uIntro',
			'uVariant',
		]);
		this.blit = compile(gl, blitVs, blitFs, ['uTex']);

		this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
			gl.STATIC_DRAW,
		);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		this.targets = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.targets);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
		gl.vertexAttribDivisor(1, 1);
		gl.bindVertexArray(null);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	}

	createTexture(): WebGLTexture {
		const { gl } = this;
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return texture;
	}

	clear() {
		const { gl } = this;
		gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
	}

	drawWhole(texture: WebGLTexture) {
		const { gl } = this;
		gl.useProgram(this.blit.program);
		this.bindTextures(this.blit, texture, texture, 'uTex');
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	// t: 0 = outgoing card intact (or nothing shown), 1 = incoming card intact.
	drawMorph(
		from: { texture: WebGLTexture; rect: Rect } | null,
		to: { texture: WebGLTexture; rect: Rect },
		stage: Size,
		t: number,
		variant: number,
		seed: number,
	) {
		const { gl } = this;
		const a = grid((from ?? to).rect, stage);
		const b = grid(to.rect, stage);
		const count = Math.max(a.cols * a.rows, b.cols * b.rows);
		const { program, u } = this.morph;
		gl.useProgram(program);
		this.bindTextures(this.morph, (from ?? to).texture, to.texture);
		gl.uniform2f(u.uStage, stage.w, stage.h);
		gl.uniform4f(u.uRectA, a.rect.x, a.rect.y, a.rect.w, a.rect.h);
		gl.uniform4f(u.uRectB, b.rect.x, b.rect.y, b.rect.w, b.rect.h);
		gl.uniform1f(u.uCellA, a.cell);
		gl.uniform1f(u.uCellB, b.cell);
		gl.uniform2i(u.uGridA, a.cols, a.rows);
		gl.uniform2i(u.uGridB, b.cols, b.rows);
		gl.uniform1f(u.uT, t);
		gl.uniform1f(u.uIntro, from ? 0 : 1);
		gl.uniform1i(u.uVariant, variant);
		const key = `${seed}:${count}`;
		if (key !== this.targetsKey) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.targets);
			gl.bufferData(gl.ARRAY_BUFFER, permutation(count, seed), gl.STATIC_DRAW);
			this.targetsKey = key;
		}
		this.drawInstances(count);
	}

	private bindTextures(p: Program, a: WebGLTexture, b: WebGLTexture, nameA = 'uTexA') {
		const { gl } = this;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, a);
		gl.uniform1i(p.u[nameA], 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, b);
		if (p.u.uTexB) gl.uniform1i(p.u.uTexB, 1);
	}

	private drawInstances(count: number) {
		const { gl } = this;
		gl.bindVertexArray(this.vao);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
		gl.bindVertexArray(null);
	}
}
