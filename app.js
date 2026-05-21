const canvas = document.getElementById("artCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const controls = {
  regenerate: document.getElementById("regenerateBtn"),
  exportImage: document.getElementById("exportImageBtn"),
  exportVideo: document.getElementById("exportVideoBtn"),
  styleEyebrow: document.getElementById("styleEyebrow"),
  styleList: document.getElementById("styleList"),
  presetList: document.getElementById("presetList"),
  density: document.getElementById("densityInput"),
  flow: document.getElementById("flowInput"),
  contour: document.getElementById("contourInput"),
  grain: document.getElementById("grainInput"),
  motion: document.getElementById("motionInput"),
  duration: document.getElementById("durationInput"),
  size: document.getElementById("sizeInput"),
  seed: document.getElementById("seedInput"),
  seedButton: document.getElementById("seedBtn"),
  paletteList: document.getElementById("paletteList"),
  status: document.getElementById("statusText"),
  frameMeta: document.getElementById("frameMeta"),
};

const styles = [
  {
    id: "mechanical",
    name: "Mechanical Field",
    note: "정렬된 링, 레일, 노드, 스캔 레이어",
  },
  {
    id: "organic",
    name: "Organic Field",
    note: "유기적 흐름, 포자, 지형선 중심",
  },
];

const presets = {
  mechanical: [
    {
      name: "Blueprint",
      note: "설계도 같은 얇은 선과 측정 링",
      paletteIndex: 4,
      density: 68,
      flow: 38,
      contour: 86,
      grain: 18,
      motion: 24,
      seed: "MECH-BLUE",
    },
    {
      name: "Circuit Garden",
      note: "자연적인 점 조직 위에 회로형 레일",
      paletteIndex: 5,
      density: 76,
      flow: 52,
      contour: 64,
      grain: 28,
      motion: 32,
      seed: "MECH-CIRCUIT",
    },
    {
      name: "Industrial Calm",
      note: "두꺼운 패널, 스트라이프, 낮은 채도",
      paletteIndex: 6,
      density: 58,
      flow: 28,
      contour: 78,
      grain: 22,
      motion: 18,
      seed: "MECH-CALM",
    },
  ],
  organic: [
    {
      name: "Gorse Tide",
      note: "식생 흐름과 밝은 포인트 컬러",
      paletteIndex: 0,
      density: 62,
      flow: 58,
      contour: 72,
      grain: 38,
      motion: 34,
      seed: "TOXO-0521",
    },
    {
      name: "Rain Bloom",
      note: "짙은 배경과 부드러운 곡선",
      paletteIndex: 2,
      density: 54,
      flow: 72,
      contour: 64,
      grain: 42,
      motion: 38,
      seed: "RAIN-BLOOM",
    },
  ],
};

const palettes = [
  {
    name: "Gorse Tide",
    colors: ["#101719", "#5b8b76", "#d9e775", "#d35a76", "#f1eee3", "#2e484c"],
  },
  {
    name: "Lichen Stone",
    colors: ["#161715", "#8aa082", "#c4c9a7", "#6d7774", "#e7e4d3", "#a44e43"],
  },
  {
    name: "Rain Bloom",
    colors: ["#12151d", "#456a71", "#a4ccc2", "#efe9d0", "#a32250", "#c9d85b"],
  },
  {
    name: "Moss Signal",
    colors: ["#12140f", "#395f47", "#8fbf7a", "#f4d56a", "#e9ece3", "#792946"],
  },
  {
    name: "Graphite Lime",
    colors: ["#101214", "#3a4346", "#d7f06a", "#eef1e8", "#9b2f54", "#20333a"],
  },
  {
    name: "Drafting Teal",
    colors: ["#0f1417", "#274d53", "#6bb7a7", "#e4e4d6", "#c4d14d", "#5b253b"],
  },
  {
    name: "Mono Calibration",
    colors: ["#111213", "#5b6260", "#cfd5c7", "#f2f0e6", "#a7b36f", "#252c31"],
  },
];

const state = {
  style: "mechanical",
  presetIndex: 0,
  paletteIndex: 4,
  seed: controls.seed.value,
  startedAt: performance.now(),
  isRecording: false,
  grainPoints: [],
  stems: [],
  pods: [],
  washes: [],
  panels: [],
  rails: [],
  rings: [],
  nodes: [],
  connectors: [],
  hatchBands: [],
};

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function randomBetween(random, min, max) {
  return min + random() * (max - min);
}

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

function snapTo(value, step) {
  return Math.round(value / step) * step;
}

function smoothNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const fadeX = xf * xf * (3 - 2 * xf);
  const fadeY = yf * yf * (3 - 2 * yf);

  const n = (ix, iy) => {
    const h = hashString(`${ix}:${iy}:${seed}`);
    return (h % 10000) / 10000;
  };

  const a = n(xi, yi);
  const b = n(xi + 1, yi);
  const c = n(xi, yi + 1);
  const d = n(xi + 1, yi + 1);
  return lerp(lerp(a, b, fadeX), lerp(c, d, fadeX), fadeY);
}

function octaveNoise(x, y, seed, octaves = 4) {
  let total = 0;
  let amp = 1;
  let freq = 1;
  let max = 0;
  for (let i = 0; i < octaves; i += 1) {
    total += smoothNoise(x * freq, y * freq, `${seed}-${i}`) * amp;
    max += amp;
    amp *= 0.52;
    freq *= 2.04;
  }
  return total / max;
}

function currentSettings() {
  const [width, height] = controls.size.value.split("x").map(Number);
  return {
    width,
    height,
    density: Number(controls.density.value) / 100,
    flow: Number(controls.flow.value) / 100,
    contour: Number(controls.contour.value) / 100,
    grain: Number(controls.grain.value) / 100,
    motion: Number(controls.motion.value) / 100,
    duration: Number(controls.duration.value),
    palette: palettes[state.paletteIndex],
    style: state.style,
  };
}

function resizeCanvas() {
  const { width, height, duration } = currentSettings();
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  controls.frameMeta.textContent = `${width}x${height} / ${duration}s`;
}

function buildComposition() {
  resizeCanvas();
  const settings = currentSettings();
  const random = mulberry32(hashString(`${state.seed}:${state.paletteIndex}:${state.style}`));
  const { width, height } = settings;
  const scale = Math.min(width, height);

  state.grainPoints = [];
  state.stems = [];
  state.pods = [];
  state.washes = [];
  state.panels = [];
  state.rails = [];
  state.rings = [];
  state.nodes = [];
  state.connectors = [];
  state.hatchBands = [];

  if (settings.style === "mechanical") {
    buildMechanicalComposition(settings, random);
    return;
  }

  const grainCount = Math.floor(1300 + settings.grain * 4600);
  for (let i = 0; i < grainCount; i += 1) {
    state.grainPoints.push({
      x: random() * width,
      y: random() * height,
      a: randomBetween(random, 0.035, 0.1),
      s: randomBetween(random, 0.45, 1.35),
    });
  }

  const washCount = Math.floor(5 + settings.contour * 7);
  for (let i = 0; i < washCount; i += 1) {
    const radius = randomBetween(random, scale * 0.18, scale * 0.44);
    state.washes.push({
      x: randomBetween(random, -width * 0.12, width * 1.12),
      y: randomBetween(random, height * 0.02, height * 0.98),
      radius,
      points: Math.floor(randomBetween(random, 9, 17)),
      wobble: randomBetween(random, 0.14, 0.36),
      rot: random() * Math.PI * 2,
      color: settings.palette.colors[1 + (i % 3)],
      alpha: randomBetween(random, 0.055, 0.14),
      drift: randomBetween(random, -1, 1),
    });
  }

  const stemCount = Math.floor(80 + settings.density * 210);
  for (let i = 0; i < stemCount; i += 1) {
    state.stems.push({
      x: randomBetween(random, -width * 0.08, width * 1.08),
      y: randomBetween(random, height * 0.04, height * 0.98),
      len: randomBetween(random, scale * 0.045, scale * 0.19),
      steps: Math.floor(randomBetween(random, 12, 32)),
      angle: randomBetween(random, -Math.PI, Math.PI),
      width: randomBetween(random, 0.75, 2.6),
      color: settings.palette.colors[2 + Math.floor(random() * 3)],
      alpha: randomBetween(random, 0.18, 0.58),
      phase: random() * Math.PI * 2,
    });
  }

  const podCount = Math.floor(14 + settings.density * 42);
  for (let i = 0; i < podCount; i += 1) {
    state.pods.push({
      x: randomBetween(random, width * 0.08, width * 0.92),
      y: randomBetween(random, height * 0.06, height * 0.94),
      r: randomBetween(random, scale * 0.008, scale * 0.035),
      halo: randomBetween(random, scale * 0.035, scale * 0.12),
      color: settings.palette.colors[2 + Math.floor(random() * 4)],
      phase: random() * Math.PI * 2,
      petals: Math.floor(randomBetween(random, 9, 22)),
    });
  }
}

function buildMechanicalComposition(settings, random) {
  const { width, height, palette } = settings;
  const scale = Math.min(width, height);
  const grid = Math.max(20, Math.round(scale / 18));
  const angles = [-Math.PI / 4, -Math.PI / 8, 0, Math.PI / 4, Math.PI / 2];

  const grainCount = Math.floor(650 + settings.grain * 2300);
  for (let i = 0; i < grainCount; i += 1) {
    state.grainPoints.push({
      x: random() * width,
      y: random() * height,
      a: randomBetween(random, 0.025, 0.08),
      s: randomBetween(random, 0.35, 1.05),
    });
  }

  const panelCount = Math.floor(7 + settings.contour * 8);
  for (let i = 0; i < panelCount; i += 1) {
    state.panels.push({
      x: snapTo(randomBetween(random, -width * 0.18, width * 1.04), grid),
      y: snapTo(randomBetween(random, height * 0.02, height * 0.96), grid),
      w: snapTo(randomBetween(random, width * 0.22, width * 0.68), grid),
      h: snapTo(randomBetween(random, height * 0.035, height * 0.12), grid / 2),
      angle: pick(random, [-Math.PI / 4, -Math.PI / 8, 0, Math.PI / 4]),
      color: palette.colors[1 + (i % 3)],
      alpha: randomBetween(random, 0.055, 0.16),
      phase: random() * Math.PI * 2,
    });
  }

  const hatchCount = Math.floor(3 + settings.density * 4);
  for (let i = 0; i < hatchCount; i += 1) {
    state.hatchBands.push({
      x: snapTo(randomBetween(random, -width * 0.08, width * 0.78), grid),
      y: snapTo(randomBetween(random, height * 0.08, height * 0.88), grid),
      w: snapTo(randomBetween(random, width * 0.34, width * 0.86), grid),
      h: snapTo(randomBetween(random, height * 0.035, height * 0.09), grid / 2),
      angle: pick(random, [-Math.PI / 4, 0, Math.PI / 4]),
      step: randomBetween(random, 10, 22),
      alpha: randomBetween(random, 0.13, 0.24),
    });
  }

  const railCount = Math.floor(24 + settings.density * 42);
  for (let i = 0; i < railCount; i += 1) {
    const angle = pick(random, angles);
    const length = randomBetween(random, scale * 0.13, scale * 0.52);
    const x = snapTo(randomBetween(random, -width * 0.05, width * 1.05), grid / 2);
    const y = snapTo(randomBetween(random, -height * 0.04, height * 1.04), grid / 2);
    state.rails.push({
      x1: x,
      y1: y,
      x2: x + Math.cos(angle) * length,
      y2: y + Math.sin(angle) * length,
      width: randomBetween(random, 0.65, 1.6),
      color: pick(random, [palette.colors[2], palette.colors[3], palette.colors[5]]),
      alpha: randomBetween(random, 0.14, 0.48),
      ticks: Math.floor(randomBetween(random, 2, 9)),
      phase: random() * Math.PI * 2,
    });
  }

  const ringCount = Math.floor(18 + settings.contour * 38);
  for (let i = 0; i < ringCount; i += 1) {
    const r = snapTo(randomBetween(random, scale * 0.025, scale * 0.14), grid / 3);
    state.rings.push({
      x: snapTo(randomBetween(random, width * 0.05, width * 0.95), grid / 2),
      y: snapTo(randomBetween(random, height * 0.04, height * 0.96), grid / 2),
      r,
      inner: randomBetween(random, 0.34, 0.72),
      color: pick(random, [palette.colors[2], palette.colors[3], palette.colors[4]]),
      alpha: randomBetween(random, 0.12, 0.4),
      segments: Math.floor(randomBetween(random, 2, 6)),
      ticks: Math.floor(randomBetween(random, 8, 28)),
      speed: randomBetween(random, -0.55, 0.55),
      phase: random() * Math.PI * 2,
    });
  }

  const nodeCount = Math.floor(48 + settings.density * 116);
  for (let i = 0; i < nodeCount; i += 1) {
    state.nodes.push({
      x: snapTo(randomBetween(random, width * 0.04, width * 0.96), grid / 2),
      y: snapTo(randomBetween(random, height * 0.04, height * 0.96), grid / 2),
      s: randomBetween(random, 3, 11),
      shape: random() > 0.42 ? "square" : "circle",
      color: pick(random, [palette.colors[2], palette.colors[3], palette.colors[4], palette.colors[5]]),
      alpha: randomBetween(random, 0.24, 0.82),
      phase: random() * Math.PI * 2,
    });
  }

  const connectorCount = Math.floor(32 + settings.flow * 72);
  for (let i = 0; i < connectorCount; i += 1) {
    const a = pick(random, state.nodes);
    const b = pick(random, state.nodes);
    state.connectors.push({
      ax: a.x,
      ay: a.y,
      bx: b.x,
      by: b.y,
      color: pick(random, [palette.colors[2], palette.colors[3], palette.colors[5]]),
      alpha: randomBetween(random, 0.07, 0.24),
      phase: random() * Math.PI * 2,
    });
  }
}

function drawMechanicalBackground(settings, phase) {
  const { width, height, palette } = settings;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.colors[0]);
  gradient.addColorStop(0.58, "#171a1b");
  gradient.addColorStop(1, "#0b0c0d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const grid = Math.max(20, Math.round(Math.min(width, height) / 18));
  const offset = phase * grid * settings.motion;
  ctx.strokeStyle = rgba(palette.colors[3], 0.055);
  ctx.lineWidth = 1;

  for (let x = -grid + (offset % grid); x < width + grid; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = -grid + ((offset * 0.64) % grid); y < height + grid; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(width * 0.5, height * 0.22);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = rgba(palette.colors[1], 0.18);
  ctx.fillRect(-width, -height * 0.09, width * 2, height * 0.2);
  ctx.restore();
}

function drawMechanicalPanels(settings, phase) {
  state.panels.forEach((panel) => {
    const drift = Math.sin(phase * Math.PI * 2 + panel.phase) * settings.motion * 4;
    ctx.save();
    ctx.translate(panel.x, panel.y + drift);
    ctx.rotate(panel.angle);
    ctx.fillStyle = rgba(panel.color, panel.alpha);
    ctx.fillRect(-panel.w / 2, -panel.h / 2, panel.w, panel.h);
    ctx.strokeStyle = rgba(settings.palette.colors[3], panel.alpha * 1.35);
    ctx.lineWidth = 1;
    ctx.strokeRect(-panel.w / 2, -panel.h / 2, panel.w, panel.h);
    ctx.restore();
  });
}

function drawMechanicalHatches(settings, phase) {
  const { palette } = settings;
  state.hatchBands.forEach((band, index) => {
    const shift = phase * band.step * 2 * settings.motion;
    ctx.save();
    ctx.translate(band.x, band.y);
    ctx.rotate(band.angle);
    ctx.beginPath();
    ctx.rect(-band.w / 2, -band.h / 2, band.w, band.h);
    ctx.clip();
    ctx.fillStyle = rgba(palette.colors[3], band.alpha * 0.26);
    ctx.fillRect(-band.w / 2, -band.h / 2, band.w, band.h);

    for (let x = -band.w; x < band.w * 1.2; x += band.step) {
      ctx.fillStyle = index % 2 === 0 ? rgba(palette.colors[3], band.alpha) : rgba(palette.colors[0], 0.42);
      ctx.fillRect(x + (shift % band.step), -band.h / 2, band.step * 0.45, band.h);
    }
    ctx.restore();
  });
}

function drawMechanicalRails(settings, phase) {
  const loop = Math.sin(phase * Math.PI * 2);
  state.rails.forEach((rail) => {
    const pulse = 0.65 + 0.35 * Math.sin(phase * Math.PI * 2 + rail.phase);
    const dx = rail.x2 - rail.x1;
    const dy = rail.y2 - rail.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const drift = loop * settings.motion * 3;

    ctx.beginPath();
    ctx.moveTo(rail.x1 + nx * drift, rail.y1 + ny * drift);
    ctx.lineTo(rail.x2 + nx * drift, rail.y2 + ny * drift);
    ctx.strokeStyle = rgba(rail.color, rail.alpha * pulse);
    ctx.lineWidth = rail.width;
    ctx.stroke();

    for (let i = 1; i < rail.ticks; i += 1) {
      const t = i / rail.ticks;
      const x = lerp(rail.x1, rail.x2, t) + nx * drift;
      const y = lerp(rail.y1, rail.y2, t) + ny * drift;
      ctx.beginPath();
      ctx.moveTo(x - nx * 5, y - ny * 5);
      ctx.lineTo(x + nx * 5, y + ny * 5);
      ctx.strokeStyle = rgba(settings.palette.colors[3], rail.alpha * 0.7);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  });
}

function drawMechanicalConnectors(settings, phase) {
  state.connectors.forEach((connector) => {
    const pulse = 0.55 + 0.45 * Math.sin(phase * Math.PI * 2 + connector.phase);
    const midX = connector.ax;
    const midY = connector.by;
    ctx.beginPath();
    ctx.moveTo(connector.ax, connector.ay);
    ctx.lineTo(midX, midY);
    ctx.lineTo(connector.bx, connector.by);
    ctx.strokeStyle = rgba(connector.color, connector.alpha * pulse);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });
}

function drawMechanicalRings(settings, phase) {
  state.rings.forEach((ring) => {
    const rotation = ring.phase + phase * Math.PI * 2 * ring.speed * settings.motion;
    ctx.save();
    ctx.translate(ring.x, ring.y);
    ctx.rotate(rotation);

    ctx.beginPath();
    ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(ring.color, ring.alpha);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, ring.r * ring.inner, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(settings.palette.colors[3], ring.alpha * 0.55);
    ctx.lineWidth = 0.75;
    ctx.stroke();

    for (let i = 0; i < ring.segments; i += 1) {
      const start = (i / ring.segments) * Math.PI * 2 + 0.14;
      const end = start + Math.PI / ring.segments;
      ctx.beginPath();
      ctx.arc(0, 0, ring.r * 1.18, start, end);
      ctx.strokeStyle = rgba(ring.color, ring.alpha * 1.3);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (let i = 0; i < ring.ticks; i += 1) {
      const a = (i / ring.ticks) * Math.PI * 2;
      const inner = ring.r * 0.9;
      const outer = ring.r * 1.02;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.strokeStyle = rgba(settings.palette.colors[3], ring.alpha * 0.7);
      ctx.lineWidth = 0.65;
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawMechanicalNodes(settings, phase) {
  state.nodes.forEach((node) => {
    const pulse = 0.65 + 0.35 * Math.sin(phase * Math.PI * 2 + node.phase);
    ctx.fillStyle = rgba(node.color, node.alpha * pulse);
    ctx.strokeStyle = rgba(settings.palette.colors[3], node.alpha * 0.35);
    ctx.lineWidth = 0.8;
    if (node.shape === "square") {
      ctx.fillRect(node.x - node.s / 2, node.y - node.s / 2, node.s, node.s);
      ctx.strokeRect(node.x - node.s / 2, node.y - node.s / 2, node.s, node.s);
    } else {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  });
}

function drawMechanicalScan(settings, phase) {
  const { width, height, palette } = settings;
  const y = ((phase * height * 1.35) - height * 0.18 + height) % height;
  const x = ((phase * width * 1.1) - width * 0.1 + width) % width;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = rgba(palette.colors[2], 0.08 * settings.motion);
  ctx.fillRect(0, y, width, Math.max(2, height * 0.006));
  ctx.fillStyle = rgba(palette.colors[4], 0.08 * settings.motion);
  ctx.fillRect(x, 0, Math.max(2, width * 0.004), height);
  ctx.restore();
}

function drawBackground(settings, phase) {
  const { width, height, palette } = settings;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.colors[0]);
  gradient.addColorStop(0.52, rgba(palette.colors[5], 0.78));
  gradient.addColorStop(1, "#0d0f10");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const bandY = height * (0.18 + Math.sin(phase * Math.PI * 2) * 0.018);
  ctx.save();
  ctx.translate(width * 0.5, bandY);
  ctx.rotate(-0.42);
  ctx.fillStyle = rgba(palette.colors[1], 0.16);
  ctx.fillRect(-width, -height * 0.08, width * 2, height * 0.22);
  ctx.restore();
}

function drawWashes(settings, phase) {
  const { width, height } = settings;
  const loopX = Math.cos(phase * Math.PI * 2);
  const loopY = Math.sin(phase * Math.PI * 2);

  state.washes.forEach((wash, index) => {
    const cx = wash.x + loopX * wash.drift * width * 0.018 * settings.motion;
    const cy = wash.y + loopY * wash.drift * height * 0.012 * settings.motion;

    ctx.beginPath();
    for (let i = 0; i <= wash.points; i += 1) {
      const a = (i / wash.points) * Math.PI * 2 + wash.rot;
      const n = octaveNoise(
        Math.cos(a) * 1.4 + index,
        Math.sin(a) * 1.4 + phase,
        `${state.seed}-wash-${index}`,
        3,
      );
      const r = wash.radius * (1 + (n - 0.5) * wash.wobble);
      const x = cx + Math.cos(a) * r * 1.38;
      const y = cy + Math.sin(a) * r * 0.72;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(wash.color, wash.alpha);
    ctx.fill();
  });
}

function flowAngle(x, y, settings, phase) {
  const nx = x / settings.width;
  const ny = y / settings.height;
  const n = octaveNoise(
    nx * (1.4 + settings.flow * 3.3) + Math.cos(phase * Math.PI * 2) * 0.22,
    ny * (1.8 + settings.flow * 4.4) + Math.sin(phase * Math.PI * 2) * 0.22,
    `${state.seed}-field`,
    4,
  );
  const base = -0.72 + settings.flow * 1.1;
  return base + (n - 0.5) * Math.PI * (1.4 + settings.flow);
}

function drawContours(settings, phase) {
  const { width, height, palette } = settings;
  const count = Math.floor(16 + settings.contour * 38);
  const amplitude = height * (0.012 + settings.flow * 0.026);
  const diagonal = -0.48;

  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(diagonal);
  ctx.translate(-width * 0.5, -height * 0.5);

  for (let i = 0; i < count; i += 1) {
    const y = lerp(-height * 0.12, height * 1.12, i / Math.max(1, count - 1));
    ctx.beginPath();
    for (let x = -width * 0.2; x <= width * 1.2; x += width / 90) {
      const n = octaveNoise(
        x / width * 3.5,
        i * 0.2 + phase * 0.7,
        `${state.seed}-contour-${i}`,
        3,
      );
      const ripple = Math.sin(x * 0.012 + i * 0.72 + phase * Math.PI * 2) * amplitude * 0.55;
      const py = y + (n - 0.5) * amplitude * 2.2 + ripple;
      if (x === -width * 0.2) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.strokeStyle = rgba(i % 5 === 0 ? palette.colors[2] : palette.colors[4], i % 5 === 0 ? 0.24 : 0.11);
    ctx.lineWidth = i % 5 === 0 ? 1.3 : 0.75;
    ctx.stroke();
  }

  ctx.restore();
}

function drawStems(settings, phase) {
  const { width, height } = settings;
  state.stems.forEach((stem) => {
    let x = stem.x + Math.cos(phase * Math.PI * 2 + stem.phase) * width * 0.012 * settings.motion;
    let y = stem.y + Math.sin(phase * Math.PI * 2 + stem.phase) * height * 0.008 * settings.motion;
    const step = stem.len / stem.steps;

    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < stem.steps; i += 1) {
      const angle = flowAngle(x, y, settings, phase) + stem.angle * 0.12;
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(stem.color, stem.alpha);
    ctx.lineWidth = stem.width;
    ctx.lineCap = "round";
    ctx.stroke();
  });
}

function drawPods(settings, phase) {
  state.pods.forEach((pod, index) => {
    const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + pod.phase);
    const drift = settings.motion * pod.r * 0.42;
    const x = pod.x + Math.cos(pod.phase + phase * Math.PI * 2) * drift;
    const y = pod.y + Math.sin(pod.phase + phase * Math.PI * 2) * drift;

    ctx.beginPath();
    ctx.arc(x, y, pod.halo * (0.88 + pulse * 0.16), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(pod.color, 0.1);
    ctx.lineWidth = 1.15;
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < pod.petals; i += 1) {
      const a = i * 2.399963 + phase * 0.55;
      const r = Math.sqrt(i / pod.petals) * pod.halo * 0.72;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      ctx.moveTo(px + pod.r * 0.35, py);
      ctx.arc(px, py, pod.r * randomStatic(index, i, 0.36, 0.9), 0, Math.PI * 2);
    }
    ctx.fillStyle = rgba(pod.color, 0.16 + pulse * 0.15);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, pod.r * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(pod.color, 0.82);
    ctx.fill();
  });
}

function randomStatic(a, b, min, max) {
  const value = ((hashString(`${state.seed}:${a}:${b}`) % 10000) / 10000);
  return lerp(min, max, value);
}

function drawStrata(settings, phase) {
  const { width, height, palette } = settings;
  const stripes = Math.floor(18 + settings.density * 26);
  const originY = height * 0.7 + Math.sin(phase * Math.PI * 2) * height * 0.016 * settings.motion;

  ctx.save();
  ctx.translate(width * 0.5, originY);
  ctx.rotate(-0.22);
  for (let i = 0; i < stripes; i += 1) {
    const x = -width * 0.74 + i * (width * 1.48 / stripes);
    ctx.fillStyle = i % 2 === 0 ? rgba(palette.colors[4], 0.13) : rgba(palette.colors[0], 0.35);
    ctx.fillRect(x, -height * 0.11, width / stripes * 0.42, height * 0.34);
  }
  ctx.restore();
}

function drawGrain(settings) {
  if (settings.grain <= 0) return;
  ctx.fillStyle = "rgba(245, 246, 235, 0.06)";
  state.grainPoints.forEach((point) => {
    ctx.globalAlpha = point.a * settings.grain;
    ctx.fillRect(point.x, point.y, point.s, point.s);
  });
  ctx.globalAlpha = 1;
}

function renderAt(timeMs) {
  const settings = currentSettings();
  const durationMs = settings.duration * 1000;
  const raw = ((timeMs - state.startedAt) % durationMs) / durationMs;
  const phase = raw < 0 ? raw + 1 : raw;

  if (settings.style === "mechanical") {
    drawMechanicalBackground(settings, phase);
    drawMechanicalPanels(settings, phase);
    drawMechanicalHatches(settings, phase);
    drawMechanicalConnectors(settings, phase);
    drawMechanicalRails(settings, phase);
    drawMechanicalRings(settings, phase);
    drawMechanicalNodes(settings, phase);
    drawMechanicalScan(settings, phase);
    drawGrain(settings);
    return;
  }

  drawBackground(settings, phase);
  drawWashes(settings, phase);
  drawContours(settings, phase);
  drawStrata(settings, phase);
  drawStems(settings, phase);
  drawPods(settings, phase);
  drawGrain(settings);
}

function animate(timeMs) {
  renderAt(timeMs);
  requestAnimationFrame(animate);
}

function refresh() {
  const activeStyle = styles.find((style) => style.id === state.style);
  controls.styleEyebrow.textContent = activeStyle ? activeStyle.name : "Generative Field";
  state.seed = controls.seed.value.trim() || (state.style === "mechanical" ? "MECH" : "FIELD");
  state.startedAt = performance.now();
  buildComposition();
  setStatus("Ready");
}

function setStatus(message) {
  controls.status.textContent = message;
}

function randomSeed() {
  const now = new Date();
  const stamp = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  const prefix = state.style === "mechanical" ? "MECH" : "FIELD";
  controls.seed.value = `${prefix}-${stamp}-${random}`;
  refresh();
}

function setControlValues(values) {
  controls.density.value = values.density;
  controls.flow.value = values.flow;
  controls.contour.value = values.contour;
  controls.grain.value = values.grain;
  controls.motion.value = values.motion;
  controls.seed.value = values.seed;
  state.paletteIndex = values.paletteIndex;
}

function applyPreset(index) {
  const list = presets[state.style] || [];
  const preset = list[index];
  if (!preset) return;
  state.presetIndex = index;
  setControlValues(preset);
  renderStyles();
  renderPresets();
  renderPalettes();
  refresh();
}

function renderStyles() {
  controls.styleList.innerHTML = "";
  styles.forEach((style) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `style-option${style.id === state.style ? " is-active" : ""}`;
    button.innerHTML = `<span>${style.name}</span><small>${style.note}</small>`;
    button.addEventListener("click", () => {
      state.style = style.id;
      state.presetIndex = 0;
      applyPreset(0);
    });
    controls.styleList.appendChild(button);
  });
}

function renderPresets() {
  controls.presetList.innerHTML = "";
  const list = presets[state.style] || [];
  list.forEach((preset, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `preset-option${index === state.presetIndex ? " is-active" : ""}`;
    button.innerHTML = `<span>${preset.name}</span><small>${preset.note}</small>`;
    button.addEventListener("click", () => applyPreset(index));
    controls.presetList.appendChild(button);
  });
}

function renderPalettes() {
  controls.paletteList.innerHTML = "";
  palettes.forEach((palette, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `palette-option${index === state.paletteIndex ? " is-active" : ""}`;
    button.innerHTML = `
      <span>${palette.name}</span>
      <span class="swatches">
        ${palette.colors.slice(1, 6).map((color) => `<span class="swatch" style="background:${color}"></span>`).join("")}
      </span>
    `;
    button.addEventListener("click", () => {
      state.paletteIndex = index;
      renderPalettes();
      refresh();
    });
    controls.paletteList.appendChild(button);
  });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function exportImage() {
  renderAt(performance.now());
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus("PNG failed");
      return;
    }
    downloadBlob(blob, `${state.seed || "field"}.png`);
    setStatus("PNG saved");
  }, "image/png");
}

function supportedVideoType() {
  const types = [
    "video/mp4;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return types.find((type) => window.MediaRecorder && MediaRecorder.isTypeSupported(type)) || "";
}

function exportVideo() {
  if (!canvas.captureStream || !window.MediaRecorder) {
    setStatus("Video unsupported");
    return;
  }

  const settings = currentSettings();
  const type = supportedVideoType();
  const chunks = [];
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const previousStart = state.startedAt;

  state.startedAt = performance.now();
  state.isRecording = true;
  controls.exportVideo.disabled = true;
  setStatus("Recording");

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    const mime = type || "video/webm";
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    downloadBlob(new Blob(chunks, { type: mime }), `${state.seed || "field"}-${settings.duration}s.${ext}`);
    state.startedAt = previousStart;
    state.isRecording = false;
    controls.exportVideo.disabled = false;
    setStatus(`${ext.toUpperCase()} saved`);
  };

  recorder.start();
  setTimeout(() => {
    if (recorder.state !== "inactive") recorder.stop();
  }, settings.duration * 1000 + 160);
}

function bindControls() {
  const liveControls = [
    controls.density,
    controls.flow,
    controls.contour,
    controls.grain,
    controls.motion,
    controls.duration,
  ];

  liveControls.forEach((control) => {
    control.addEventListener("input", () => {
      if (control === controls.grain || control === controls.motion || control === controls.duration) {
        resizeCanvas();
      } else {
        buildComposition();
      }
    });
  });

  controls.size.addEventListener("change", refresh);
  controls.seed.addEventListener("change", refresh);
  controls.regenerate.addEventListener("click", randomSeed);
  controls.seedButton.addEventListener("click", randomSeed);
  controls.exportImage.addEventListener("click", exportImage);
  controls.exportVideo.addEventListener("click", exportVideo);
}

bindControls();
applyPreset(0);
requestAnimationFrame(animate);
