/* eslint-disable react/no-unknown-property -- react-three-fiber elements (mesh, group, color) take three.js props, not DOM ones. */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Parâmetros ajustáveis (Modo Flat / Clean)                          */
/* ------------------------------------------------------------------ */

/** Espessura da parede da "muralha" (raio externo − raio interno). */
const RING_WALL = 0.038;
/** Altura da "muralha" (largura da cinta dos anéis). */
const RING_HEIGHT = 0.52;
/** Quanto as bordas da cinta se curvam para dentro (0 = parede reta). */
const RING_CURVE = 0;
/** Segmentos ao redor do círculo. */
const RING_SEGMENTS = 192;

/**
 * Coloração da silhueta em cinza escuro sólido (100% opaco, sem textura).
 */
const SILHOUETTE_PALETTES = {
  dark: {
    color: '#4e5361', // cinza escuro calibrado para destacar com elegância no fundo escuro
  },
  light: {
    color: '#363942', // cinza escuro sólido no fundo claro
  },
};

/**
 * Configuração de cada anel (diferença de raio reduzida de 0.35 para 0.28).
 * - radius:   raio do anel
 * - tilt:     rotação inicial (rad) em X/Y/Z, para não começarem alinhados
 * - spin:     velocidade de rotação (rad/s) em X/Y/Z — sinais diferentes = direções diferentes
 */
const RINGS: { radius: number; tilt: [number, number, number]; spin: [number, number, number] }[] = [
  { radius: 1.1, tilt: [0.4, 0.0, 0.0], spin: [0.35, 0.12, 0.0] },
  { radius: 1.38, tilt: [0.0, 0.9, 0.3], spin: [-0.15, -0.3, 0.05] },
  { radius: 1.66, tilt: [1.2, 0.3, 0.0], spin: [0.1, 0.22, -0.08] },
];

const FLOAT_AMPLITUDE = 0.15; // quanto sobe/desce
const FLOAT_SPEED = 0.8; // velocidade da flutuação

/**
 * Cinta circular: um cilindro oco de parede fina (raio externo `radius`,
 * espessura `wall`, altura `height`). Com `curve > 0` a parede se curva e
 * as bordas superior/inferior se recolhem `curve` unidades em direção ao centro.
 * O eixo do anel fica em Z (mesma orientação do antigo toro).
 *
 * A geometria é feita revolucionando 4 perfis (parede externa, interna e as
 * 2 bordas) separadamente, para manter as arestas vivas entre eles.
 */
function createBandGeometry(radius: number, wall: number, height: number, curve: number, segments: number) {
  const h = height;
  const steps = 32; // subdivisões ao longo da altura (suavidade da curva)

  // recuo da parede na altura y: 0 no meio, `curve` nas bordas (parabólico)
  const inset = (y: number) => curve * ((2 * y) / h) ** 2;

  // Cada perfil é uma lista de pontos [r, y]. A ordem define o lado "de fora":
  // a normal é a tangente (dr, dy) girada para (dy, -dr).
  const outerWall: [number, number][] = [];
  const innerWall: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const y = -h / 2 + (h * i) / steps;
    outerWall.push([radius - inset(y), y]); // de baixo para cima → normal para fora
  }
  for (let i = steps; i >= 0; i--) {
    const y = -h / 2 + (h * i) / steps;
    innerWall.push([radius - wall - inset(y), y]); // de cima para baixo → normal para dentro
  }
  const e = inset(h / 2);
  const topEdge: [number, number][] = [
    [radius - e, h / 2],
    [radius - wall - e, h / 2],
  ];
  const bottomEdge: [number, number][] = [
    [radius - wall - e, -h / 2],
    [radius - e, -h / 2],
  ];

  const profiles = [outerWall, innerWall, topEdge, bottomEdge];

  const positions: number[] = [];
  const indices: number[] = [];

  for (const profile of profiles) {
    const base = positions.length / 3;
    const m = profile.length;
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      for (let j = 0; j < m; j++) {
        const [r, y] = profile[j];
        positions.push(r * sin, y, r * cos);
      }
    }
    for (let s = 0; s < segments; s++) {
      for (let j = 0; j < m - 1; j++) {
        const a = base + s * m + j;
        const b = base + (s + 1) * m + j;
        const c = a + 1;
        const d = b + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry.rotateX(Math.PI / 2);
}

/** Estado da IA para controlar a semântica de cada anel. */
export type GyroAiState = 'idle' | 'thinking' | 'speaking';

/** Estado de animação compartilhado, suavizado a cada frame em direção às metas. */
type AnimState = {
  ringSpeeds: [number, number, number]; // [interno, meio, exterior]
};
type AnimRef = React.RefObject<AnimState>;

function Ring({
  index,
  radius,
  tilt,
  spin,
  anim,
  themeConfig,
}: (typeof RINGS)[number] & {
  index: number;
  anim: AnimRef;
  themeConfig: (typeof SILHOUETTE_PALETTES)['dark'];
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const geometry = useMemo(
    () => createBandGeometry(radius, RING_WALL, RING_HEIGHT, RING_CURVE, RING_SEGMENTS),
    [radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Material único: silhueta plana uniforme 100% sólida (zero transparência)
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: themeConfig.color,
        side: THREE.DoubleSide,
      }),
    [themeConfig],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    const s = dt * anim.current.ringSpeeds[index];
    ref.current.rotation.x += spin[0] * s;
    ref.current.rotation.y += spin[1] * s;
    ref.current.rotation.z += spin[2] * s;
  });
  return <mesh ref={ref} rotation={tilt} geometry={geometry} material={material} />;
}

function Gyroscope({
  themeConfig,
  state = 'idle',
  speed = 1,
}: {
  themeConfig: (typeof SILHOUETTE_PALETTES)['dark'];
  state?: GyroAiState;
  speed?: number;
}) {
  const group = useRef<THREE.Group>(null!);
  const anim = useRef<AnimState>({
    ringSpeeds: [1, 1, 1],
  });

  useFrame(({ clock }, dt) => {
    const a = anim.current;
    const t = clock.elapsedTime;

    // 1. Anel interno: ciclo de 10s -> acelera para 2.5x durante 2s
    const innerBurst = t % 10 < 2 ? 2.5 : 1.0;

    // 2. Anel do meio: 2.5x enquanto o sistema está pensando
    const middleBurst = state === 'thinking' ? 2.5 : 1.0;

    // 3. Anel exterior: 2.5x enquanto a IA está respondendo/escrevendo
    const outerBurst = state === 'speaking' ? 2.5 : 1.0;

    // Metas suavizadas
    const k = 1 - Math.exp(-dt * 4.5);
    a.ringSpeeds[0] += (innerBurst * speed - a.ringSpeeds[0]) * k;
    a.ringSpeeds[1] += (middleBurst * speed - a.ringSpeeds[1]) * k;
    a.ringSpeeds[2] += (outerBurst * speed - a.ringSpeeds[2]) * k;

    group.current.position.y = Math.sin(t * FLOAT_SPEED) * FLOAT_AMPLITUDE;
  });

  return (
    <group ref={group}>
      {RINGS.map((r, i) => (
        <Ring key={i} index={i} {...r} anim={anim} themeConfig={themeConfig} />
      ))}
    </group>
  );
}

export type GyroscopeCanvasProps = {
  /** Cor do ponto central (legado / opcional). */
  coreColor?: string;
  /** Cor de fundo (opcional). Se omitido ou 'transparent', o fundo fica transparente. */
  background?: string;
  /** Tema ativo ('dark' | 'light') para harmonizar a silhueta. */
  theme?: 'dark' | 'light';
  /** Estado da IA que orquestra a aceleração independente dos anéis. */
  state?: GyroAiState;
  /** Multiplicador base geral de rotação (1 = normal). */
  speed?: number;
  /** Opacidade geral do elemento na camada de composição (ex: 0.45 para efeito suave sem sobreposição interna). */
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
};

/** Componente pronto para ser colocado em qualquer app React. Ocupa 100% do container pai. */
export function GyroscopeCanvas({
  background,
  theme = 'dark',
  state = 'idle',
  speed = 1,
  opacity,
  className,
  style,
}: GyroscopeCanvasProps) {
  const isTransparent = !background || background === 'transparent';
  const themeConfig = SILHOUETTE_PALETTES[theme] || SILHOUETTE_PALETTES.dark;

  return (
    <Canvas
      className={className}
      style={{ pointerEvents: 'none', opacity, ...style }} // a cena ignora o mouse
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5.5], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      {!isTransparent && <color attach="background" args={[background]} />}
      <Gyroscope themeConfig={themeConfig} state={state} speed={speed} />
    </Canvas>
  );
}
