
export class EngineObjectRaw {
    constructor(
        public device: GPUDevice,
        public adapter: GPUAdapter,
        public canvas: HTMLCanvasElement,
        public canvasContext: GPUCanvasContext,
        public navigatorGpuInfo: NavigatorGPU["gpu"],
        public lost: boolean = false
    ) { }
}
export namespace EO {
    export type PERF_TYPE = "low" | "high";
    export type FEATURE_LEVEL = "compatibility" | "core"
    export interface ADAPTER_CONFIG {
        performance?: PERF_TYPE;
        featureLevel?: FEATURE_LEVEL,
        supportXR?: boolean;
    }
    export interface DEVICE_CONFIG {
        queueLabel?: string,
        label?: string;
        limits?: Partial<Record<keyof InstanceType<typeof GPUSupportedLimits>, number>>,
        features?: GPUFeatureName[]
    }
    export interface CONFIG {
        adapterConfig: ADAPTER_CONFIG,
        deviceConfig: DEVICE_CONFIG,
        canvasConfig: Omit<Omit<GPUCanvasConfiguration, "device">, "format">
    }
    export async function get(
        canvas: HTMLElement,
        config: CONFIG
    ): Promise<EngineObjectRaw> {
        const eo: Partial<EngineObjectRaw> = {};
        if (!navigator.gpu) {
            throw new Error("navigator.gpu not found", { cause: "WebGPU might not be supported." })
        }
        const nvgpu = navigator.gpu;
        eo.navigatorGpuInfo = nvgpu;
        const adapter = await nvgpu.requestAdapter({
            "featureLevel": config.adapterConfig.featureLevel,
            "powerPreference": config.adapterConfig.performance === "high" ?
                "high-performance" :
                config.adapterConfig.performance === "low" ?
                    "low-power" : void 0,
            "forceFallbackAdapter": false,
            xrCompatible: config.adapterConfig.supportXR,
        });
        if (!adapter) { throw new Error("Adapter could not be fetched", { cause: "WebGPU might not be supported." }) }
        eo.adapter = adapter; adapter.limits
        const device = await adapter.requestDevice({
            "defaultQueue": { label: config.deviceConfig.queueLabel },
            "label": config.deviceConfig.label,
            "requiredFeatures": config.deviceConfig.features,
            "requiredLimits": config.deviceConfig.limits,
        }).catch(e => { })
        if (!device) {
            throw new Error("Failed to create device. The device may not have the required features or limits as requested.")
        };
        eo.device = device;
        eo.canvas = canvas as HTMLCanvasElement;
        const canvasContext = eo.canvas.getContext("webgpu")
        if (!canvasContext) {
            throw new Error("Could not find gpu canvas context in given canvas")
        }
        eo.canvasContext = canvasContext;
        eo.lost = false;
        canvasContext.configure({ "format": nvgpu.getPreferredCanvasFormat(), "device": device, "usage": GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT, ...config.canvasConfig });
        return eo as EngineObjectRaw;
    }
}