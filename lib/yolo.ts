// Detector YOLO26n para navegadores — fallback dinámico de runtime (WebGPU → WebGL → WASM)
// Carga onnxruntime-web via <script> tag desde /ort-wasm/ort.all.min.js.

export type Detection = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
  classId: number;
  label?: string;
  color?: string;
  isToyCar?: boolean;
};

// 80 Clases COCO traducidas al español
export const COCO_CLASSES: Record<number, string> = {
  0: "persona",
  1: "bicicleta",
  2: "carro",
  3: "motocicleta",
  4: "avión",
  5: "autobús",
  6: "tren",
  7: "camión",
  8: "barco",
  9: "semáforo",
  10: "boca de incendio",
  11: "señal de pare",
  12: "parquímetro",
  13: "banca",
  14: "pájaro",
  15: "gato",
  16: "perro",
  17: "caballo",
  18: "oveja",
  19: "vaca",
  20: "elefante",
  21: "oso",
  22: "cebra",
  23: "jirafa",
  24: "mochila",
  25: "sombrilla",
  26: "bolso",
  27: "corbata",
  28: "maleta",
  29: "frisbee",
  30: "esquís",
  31: "snowboard",
  32: "pelota",
  33: "cometa",
  34: "bate de béisbol",
  35: "guante de béisbol",
  36: "patineta",
  37: "tabla de surf",
  38: "raqueta de tenis",
  39: "botella",
  40: "copa de vino",
  41: "taza",
  42: "tenedor",
  43: "cuchillo",
  44: "cuchara",
  45: "tazón",
  46: "plátano",
  47: "manzana",
  48: "sándwich",
  49: "naranja",
  50: "brócoli",
  51: "zanahoria",
  52: "hot dog",
  53: "pizza",
  54: "dona",
  55: "pastel",
  56: "silla",
  57: "sofá",
  58: "planta",
  59: "cama",
  60: "mesa",
  61: "inodoro",
  62: "televisor",
  63: "laptop",
  64: "mouse",
  65: "control remoto",
  66: "teclado",
  67: "celular",
  68: "microondas",
  69: "horno",
  70: "tostadora",
  71: "fregadero",
  72: "refrigerador",
  73: "libro",
  74: "reloj",
  75: "florero",
  76: "tijeras",
  77: "peluche",
  78: "secador",
  79: "cepillo de dientes",
};

const INV_255 = 1 / 255;

export type Options = {
  confThreshold?: number;
  iouThreshold?: number;
  classLabels?: Record<number, string>;
  defaultColor?: string;
  isToyCarModel?: boolean;
  inputSize?: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function iou(a: Detection, b: Detection): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = ix * iy;
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return union > 0 ? inter / union : 0;
}

function nms(dets: Detection[], iouThr: number): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const keep: Detection[] = [];
  for (const d of sorted) {
    if (keep.every((k) => iou(k, d) < iouThr)) keep.push(d);
  }
  return keep;
}

function loadOrtScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).ort) { resolve(); return; }
    const existing = document.getElementById("ort-local");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "ort-local";
    s.src = "/ort-wasm/ort.all.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar /ort-wasm/ort.all.min.js"));
    document.head.appendChild(s);
  });
}

export class YoloDetector {
  public backend: string;
  public modelUrl: string;
  private ort: any;
  private session: any;
  private inputName: string;
  private conf: number;
  private iouThr: number;
  public inputSize: number;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: Float32Array;
  private classLabels?: Record<number, string>;
  private defaultColor?: string;
  private isToyCarModel: boolean;

  private constructor(ort: any, session: any, backend: string, modelUrl: string, opts: Options) {
    this.ort = ort;
    this.session = session;
    this.backend = backend;
    this.modelUrl = modelUrl;
    this.inputName = session.inputNames[0] ?? "images";
    this.conf = opts.confThreshold ?? 0.35;
    this.iouThr = opts.iouThreshold ?? 0.40;
    this.inputSize = opts.inputSize ?? 320;
    this.classLabels = opts.classLabels;
    this.defaultColor = opts.defaultColor;
    this.isToyCarModel = opts.isToyCarModel ?? false;

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.inputSize;
    this.canvas.height = this.inputSize;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.buffer = new Float32Array(3 * this.inputSize * this.inputSize);
  }

  public setConfThreshold(conf: number) {
    this.conf = Math.max(0.04, Math.min(0.95, conf));
  }

  public getConfThreshold(): number {
    return this.conf;
  }

  public setIouThreshold(iou: number) {
    this.iouThr = Math.max(0.1, Math.min(0.9, iou));
  }

  static async create(modelUrl: string, opts: Options = {}): Promise<YoloDetector> {
    await loadOrtScript();
    const ort = (window as any).ort;
    if (!ort) throw new Error("onnxruntime-web no cargó correctamente.");

    ort.env.wasm.wasmPaths = "/ort-wasm/";
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;

    const size = opts.inputSize ?? 320;
    console.log(`[YOLO26n] Cargando modelo ONNX (${size}x${size}) desde ${modelUrl}...`);

    // 1. Intentar WebGPU
    try {
      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ["webgpu"],
        graphOptimizationLevel: "all",
      });
      console.log(`[YOLO26n] ⚡ Backend: WebGPU NATIVO Activo (${modelUrl})`);
      return new YoloDetector(ort, session, "WebGPU (GPU)", modelUrl, opts);
    } catch (gpuErr) {
      console.warn(`[YOLO26n] WebGPU no disponible para ${modelUrl} → probando WebGL...`, gpuErr);
    }

    // 2. Intentar WebGL
    try {
      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ["webgl"],
        graphOptimizationLevel: "basic",
      });
      console.log(`[YOLO26n] ⚡ Backend: WebGL Activo (${modelUrl})`);
      return new YoloDetector(ort, session, "WebGL (GPU)", modelUrl, opts);
    } catch (webglErr) {
      console.warn(`[YOLO26n] WebGL no disponible para ${modelUrl} → usando WASM...`, webglErr);
    }

    // 3. Fallback WASM CPU
    const session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    console.log(`[YOLO26n] ⚡ Backend: WASM (CPU SIMD) (${modelUrl})`);
    return new YoloDetector(ort, session, "WASM (CPU)", modelUrl, opts);
  }

  async detect(video: HTMLVideoElement): Promise<Detection[]> {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return [];

    const IS = this.inputSize;
    const scale = Math.min(IS / vw, IS / vh);
    const nw = Math.round(vw * scale);
    const nh = Math.round(vh * scale);
    const padX = Math.floor((IS - nw) / 2);
    const padY = Math.floor((IS - nh) / 2);

    this.ctx.fillStyle = "rgb(114,114,114)";
    this.ctx.fillRect(0, 0, IS, IS);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.ctx.drawImage(video, padX, padY, nw, nh);

    const { data } = this.ctx.getImageData(0, 0, IS, IS);
    const plane = IS * IS;
    const buf = this.buffer;

    for (let i = 0; i < plane; i++) {
      const j = i * 4;
      buf[i] = data[j] * INV_255;
      buf[plane + i] = data[j + 1] * INV_255;
      buf[2 * plane + i] = data[j + 2] * INV_255;
    }

    try {
      const tensor = new this.ort.Tensor("float32", buf, [1, 3, IS, IS]);
      const results = await this.session.run({ [this.inputName]: tensor });
      const output = results[this.session.outputNames[0]];
      return this.decode(output, scale, padX, padY, vw, vh, IS);
    } catch (runErr) {
      if (this.backend.includes("GPU")) {
        console.warn(`[YOLO26n] Error en ${this.backend}. Cambiando a WASM (CPU SIMD)...`, runErr);
        this.session = await this.ort.InferenceSession.create(this.modelUrl, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
        this.backend = "WASM (CPU SIMD)";
        const tensor = new this.ort.Tensor("float32", buf, [1, 3, IS, IS]);
        const results = await this.session.run({ [this.inputName]: tensor });
        const output = results[this.session.outputNames[0]];
        return this.decode(output, scale, padX, padY, vw, vh, IS);
      }
      throw runErr;
    }
  }

  private decode(
    output: any,
    scale: number,
    padX: number,
    padY: number,
    vw: number,
    vh: number,
    IS: number = 320
  ): Detection[] {
    const data = output.data as Float32Array;
    const dims = output.dims as number[];
    const [, a, b] = dims;

    const toVidX1 = (x1: number) => clamp((x1 - padX) / scale, 0, vw);
    const toVidY1 = (y1: number) => clamp((y1 - padY) / scale, 0, vh);
    const toVidX2 = (x2: number) => clamp((x2 - padX) / scale, 0, vw);
    const toVidY2 = (y2: number) => clamp((y2 - padY) / scale, 0, vh);

    const dets: Detection[] = [];

    // Formato NMS End-to-End [1, N, 6]
    if (b === 6 && a <= 1000) {
      for (let i = 0; i < a; i++) {
        const o = i * 6;
        const score = data[o + 4];
        const classId = Math.round(data[o + 5]);
        if (score < this.conf) continue;
        const { label, color } = this.getLabelAndColor(classId);
        dets.push({
          x1: toVidX1(data[o]),
          y1: toVidY1(data[o + 1]),
          x2: toVidX2(data[o + 2]),
          y2: toVidY2(data[o + 3]),
          score,
          classId,
          label,
          color,
          isToyCar: this.isToyCarModel,
        });
      }
      return dets;
    }

    // Formato YOLO [1, C, A]
    const chFirst = a < b;
    const channels = chFirst ? a : b;
    const anchors = chFirst ? b : a;
    const numClasses = channels - 4;

    const maxSide = IS * 0.70;
    const maxArea = IS * IS * 0.40;

    if (chFirst) {
      const stride = anchors;
      const row0 = 0;
      const row1 = stride;
      const row2 = 2 * stride;
      const row3 = 3 * stride;

      for (let i = 0; i < anchors; i++) {
        let bestId = -1;
        let bestScore = this.conf;

        for (let c = 0; c < numClasses; c++) {
          const s = data[(4 + c) * stride + i];
          if (s > bestScore) {
            bestScore = s;
            bestId = c;
          }
        }

        if (bestId >= 0) {
          const cx = data[row0 + i];
          const cy = data[row1 + i];
          const w = data[row2 + i];
          const h = data[row3 + i];

          // Filtro para toy-car: descartar fondos de pantalla completa / gigantes
          if (this.isToyCarModel) {
            if (w * h > maxArea) continue;
            if (w > maxSide || h > maxSide) continue;
          }

          const vx1 = toVidX1(cx - w * 0.5);
          const vy1 = toVidY1(cy - h * 0.5);
          const vx2 = toVidX2(cx + w * 0.5);
          const vy2 = toVidY2(cy + h * 0.5);
          if (vx2 - vx1 < 6 || vy2 - vy1 < 6) continue;

          const { label, color } = this.getLabelAndColor(bestId);
          dets.push({
            x1: vx1,
            y1: vy1,
            x2: vx2,
            y2: vy2,
            score: bestScore,
            classId: bestId,
            label,
            color,
            isToyCar: this.isToyCarModel,
          });
        }
      }
    } else {
      for (let i = 0; i < anchors; i++) {
        const offset = i * channels;
        let bestId = -1;
        let bestScore = this.conf;

        for (let c = 0; c < numClasses; c++) {
          const s = data[offset + 4 + c];
          if (s > bestScore) {
            bestScore = s;
            bestId = c;
          }
        }

        if (bestId >= 0) {
          const cx = data[offset];
          const cy = data[offset + 1];
          const w = data[offset + 2];
          const h = data[offset + 3];

          if (this.isToyCarModel) {
            if (w * h > maxArea) continue;
            if (w > maxSide || h > maxSide) continue;
          }

          const vx1 = toVidX1(cx - w * 0.5);
          const vy1 = toVidY1(cy - h * 0.5);
          const vx2 = toVidX2(cx + w * 0.5);
          const vy2 = toVidY2(cy + h * 0.5);
          if (vx2 - vx1 < 6 || vy2 - vy1 < 6) continue;

          const { label, color } = this.getLabelAndColor(bestId);
          dets.push({
            x1: vx1,
            y1: vy1,
            x2: vx2,
            y2: vy2,
            score: bestScore,
            classId: bestId,
            label,
            color,
            isToyCar: this.isToyCarModel,
          });
        }
      }
    }

    return nms(dets, this.iouThr);
  }

  private getLabelAndColor(classId: number): { label: string; color: string } {
    const isToyCar = this.isToyCarModel;
    const label = this.classLabels?.[classId]
      ?? (isToyCar ? "toy-car" : (COCO_CLASSES[classId] ?? `Objeto ${classId}`));
    const color = this.defaultColor
      ?? (isToyCar ? "#f95721" : (classId === 0 ? "#10b981" : "#22d3ee"));
    return { label, color };
  }

  dispose() {
    this.session?.release?.().catch?.(() => { });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detector DUAL: Combina Modelo Carritos (best.onnx) + Modelo COCO (Personas)
// ─────────────────────────────────────────────────────────────────────────────
export class DualYoloDetector {
  public backend: string;
  public detectorGeneral: YoloDetector;
  public detectorToyCar: YoloDetector;

  constructor(general: YoloDetector, toyCar: YoloDetector) {
    this.detectorGeneral = general;
    this.detectorToyCar = toyCar;
    this.backend =
      general.backend === toyCar.backend
        ? `${toyCar.backend} (Dual)`
        : `${toyCar.backend} + ${general.backend}`;
  }

  async detect(video: HTMLVideoElement): Promise<Detection[]> {
    // Inferencia secuencial para evitar contención de GPU
    const toyDets = await this.detectorToyCar.detect(video);
    const generalDets = await this.detectorGeneral.detect(video);

    // Conservar personas del modelo general (classId === 0)
    // Descartar cualquier otra detección de COCO que se solape con toy-car
    const finalGeneral = generalDets.filter((gd) => {
      if (gd.classId !== 0) return false;
      const overlapsToy = toyDets.some((td) => iou(td, gd) > 0.50);
      return !overlapsToy;
    });

    return [...toyDets, ...finalGeneral];
  }

  dispose() {
    this.detectorGeneral.dispose();
    this.detectorToyCar.dispose();
  }

  static async createDual(
    urlGeneral = "/models/yolo26n_webgpu.onnx",
    urlBest = "/models/best.onnx"
  ): Promise<DualYoloDetector | YoloDetector> {
    try {
      const [toyCar, general] = await Promise.all([
        YoloDetector.create(urlBest, {
          classLabels: { 0: "toy-car" },
          defaultColor: "#f95721",
          confThreshold: 0.35,
          iouThreshold: 0.35,
          isToyCarModel: true,
          inputSize: 640, // best.onnx usa imgsz=640
        }),
        YoloDetector.create(urlGeneral, {
          confThreshold: 0.38,
          inputSize: 320,
        }),
      ]);
      console.log("[DualYolo] ✅ Dual (best.onnx 640px + COCO 320px) listo.");
      return new DualYoloDetector(general, toyCar);
    } catch (err) {
      console.warn("[DualYolo] Error iniciando Dual, fallback a modelo general:", err);
      return await YoloDetector.create(urlGeneral);
    }
  }

  static async createBestOnly(urlBest = "/models/best.onnx"): Promise<YoloDetector> {
    return await YoloDetector.create(urlBest, {
      classLabels: { 0: "toy-car" },
      defaultColor: "#f95721",
      confThreshold: 0.35,
      iouThreshold: 0.35,
      isToyCarModel: true,
      inputSize: 640,
    });
  }
}
