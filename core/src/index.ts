import { DynamicGPUObjectManager, StaticGPUObjectManager } from "./objectManager";

export class Cosmos {
    /**
     * Creates a ***cosmos** instance*.
     * @param engineObject Create using ***`Cosmos.EngineObject.get`***
     * @throws a `Error` if the ***engine object** is not given*
     * @throws a `Error` if any ***property in engine object** is invalid*
     * @throws a `Error` if the given ***engineObject's device** is being used*
     */
    constructor(public readonly engineObject: Cosmos.ENGINE_OBJECT) {
        if (!engineObject) {
            throw new Error("[Cosmos] Engine object was not given. Create a engineObject using Cosmos.EngineObject.get")
        }
        if ((engineObject.device as any).__cos_beingUsed) {
            throw new Error("[Cosmos] The current device in the engine object is being used by another Cosmos instance.")
        }
        const adapterInvalid = engineObject?.adapter?.__brand !== "GPUAdapter"
        const canvasInvalid = !("getContext" in engineObject?.canvas)
        const deviceInvalid = engineObject?.device?.__brand !== "GPUDevice"
        const canvasContextInvalid = engineObject?.canvasContext?.__brand !== "GPUCanvasContext"
        const gpuInvalid = engineObject?.navigatorGpuInfo?.__brand !== "GPU"
        if (
            new Set([adapterInvalid, canvasInvalid, deviceInvalid, canvasContextInvalid, gpuInvalid]).has(true)
        ) {
            let message = `[Cosmos] The given engineObject is invalid due to the follow reasons:`
            for (const [a, b] of [[adapterInvalid, "Adapter is Invalid"], [canvasInvalid, "Canvas is invalid"], [deviceInvalid, "Device is invalid"], [canvasContextInvalid, "CanvasContext is invalid"], [gpuInvalid, "navigatorGpuInfo is invalid"]] as const) {
                if (a) {
                    message += "\n- " + b
                }
            }
            throw new Error(message)
        }
        (engineObject.device as any).__cos_beingUsed = true;
        engineObject.device.lost.then(info => {
            console.error(`[Cosmos] The GPUObject was lost due to the follow reason:
${info.message}`)
            engineObject.lost = true;
        })
        this.DynamicGPUObjectManager = DynamicGPUObjectManager(engineObject);
        this.StaticGPUObjectManager = StaticGPUObjectManager(engineObject);
        this.DynamicPass = DynamicPass(engineObject);
        this.StaticPass = StaticPass(engineObject);
        this.DynamicComputeInstructions = DynamicComputeInstructions(engineObject);
        this.DynamicRenderInstructions = DynamicRenderInstructions(engineObject);
        this.StaticRenderInstructions = StaticRenderInstructions(engineObject);
        this.z_DynamicComputeInstructionsEncoder = DynamicComputeInstructionsEncoder(engineObject);
        this.z_DynamicRenderInstructionsEncoder = DynamicRenderInstructionsEncoder(engineObject);
        this.z_StaticRenderInstructionsEncoder = StaticRenderInstructionsEncoder(engineObject);
        this.z_CommandEncoder = DynamicCommandEncoder(engineObject);
        this.z_SRIDPE = StaticRenderInstructionsDynamicPrepassEncoder(engineObject);
    }
    /**
     * # StaticGPUObjectManager
     * A **GPUObjectManager** unlike *DynamicGPUObjectManager*, where properties, once initialized, cannot be set again;
     */
    StaticGPUObjectManager: ReturnType<typeof StaticGPUObjectManager>;
    /**
     * # DynamicGPUObjectManager
     * A **GPUObjectManager**, Where the properties, once initialized, can be overwritten any time.
     */
    DynamicGPUObjectManager: ReturnType<typeof DynamicGPUObjectManager>;
    /**
     * # DynamicPass
     * A **Pass** where a render pass is ran
     * 
     * 
     * ###### // TODO: pls fix this jsdoc
     */
    DynamicPass: ReturnType<typeof DynamicPass>;
    /**
     * # Static pass
     * 
     * A **Pass** where a render bundle is generated for every render bundle.
     */
    StaticPass: ReturnType<typeof StaticPass>;
    /**
     * # DynamicRenderInstructions
     */
    DynamicRenderInstructions: ReturnType<typeof DynamicRenderInstructions>;
    /**
     * # DynamicComputeInstructions
     */
    DynamicComputeInstructions: ReturnType<typeof DynamicComputeInstructions>;
    /**
     * # StaticRenderInstructions
     */
    StaticRenderInstructions: ReturnType<typeof StaticRenderInstructions>;
    z_DynamicRenderInstructionsEncoder: ReturnType<typeof DynamicRenderInstructionsEncoder>;
    z_DynamicComputeInstructionsEncoder: ReturnType<typeof DynamicComputeInstructionsEncoder>;
    z_StaticRenderInstructionsEncoder: ReturnType<typeof StaticRenderInstructionsEncoder>;
    z_CommandEncoder: ReturnType<typeof DynamicCommandEncoder>;
    z_SRIDPE: ReturnType<typeof StaticRenderInstructionsDynamicPrepassEncoder>
    async execDyn(passes: InstanceType<typeof this.DynamicPass>[]) {
        const cmdEncoder = this.engineObject.device.createCommandEncoder({
            label: `[Cosmos.execDyn] at ${new Date(Date.now()).toISOString()}`
        })
        const drie = new this.z_DynamicRenderInstructionsEncoder(cmdEncoder);
        const dcie = new this.z_DynamicComputeInstructionsEncoder(cmdEncoder);
        const dce = new this.z_CommandEncoder(cmdEncoder);
        const dr = {
            async render(i: InstanceType<ReturnType<typeof DynamicRenderInstructions>>) {
                await i.callback(drie, dce);
            }
        };
        const dc = {
            async compute(i: InstanceType<ReturnType<typeof DynamicComputeInstructions>>) {
                await i.callback(dcie, dce);
            }
        }
        for (const pass of passes) {
            await pass.callback(dr, dc);
        }
        this.engineObject.device.queue.submit([cmdEncoder.finish()])
    }
    execDynSync(passes: InstanceType<typeof this.DynamicPass>[]) {
        const cmdEncoder = this.engineObject.device.createCommandEncoder({
            label: `[Cosmos.execDynSync] at ${new Date(Date.now()).toISOString()}`
        })
        const drie = new this.z_DynamicRenderInstructionsEncoder(cmdEncoder);
        const dcie = new this.z_DynamicComputeInstructionsEncoder(cmdEncoder);
        const dce = new this.z_CommandEncoder(cmdEncoder);
        const dr = {
            render(i: InstanceType<ReturnType<typeof DynamicRenderInstructions>>) {
                i.callback(drie, dce);
            }
        };
        const dc = {
            compute(i: InstanceType<ReturnType<typeof DynamicComputeInstructions>>) {
                i.callback(dcie, dce);
            }
        }
        for (const pass of passes) {
            pass.callback(dr, dc);
        }
        this.engineObject.device.queue.submit([cmdEncoder.finish()])
    }
    async execStatic(passes: InstanceType<typeof this.StaticPass>[]) {
        const srie = new this.z_StaticRenderInstructionsEncoder();
        const bundles: StaticRenderInstructionsEncoder.OUTPUT[] = []
        const sr = {
            async render(i: InstanceType<ReturnType<typeof StaticRenderInstructions>>) {
                if (i.z_renderBundleCache) {
                    bundles.push(...i.z_renderBundleCache)
                } else {
                    i.z_renderBundleCache = await i.callback(srie);
                    bundles.push(...(i.z_renderBundleCache));
                }
            }
        }
        for (const pass of passes) {
            await pass.callback(sr);
        }
        const cmdEncoder = this.engineObject.device.createCommandEncoder();
        for (const bundle of bundles) {
            const pass = cmdEncoder.beginRenderPass(bundle.renderPassDescriptor);
            if (bundle.dynamicPrepass) {
                const sridpe = new this.z_SRIDPE(pass, bundle.renderPassDescriptor)
                await bundle.dynamicPrepass(sridpe);
            }
            pass.executeBundles([bundle.renderBundle]);
            pass.end();
        }
        this.engineObject.device.queue.submit([cmdEncoder.finish()])
    }
    execStaticSync(passes: InstanceType<typeof this.StaticPass>[]) {
        const srie = new this.z_StaticRenderInstructionsEncoder();
        const bundles: StaticRenderInstructionsEncoder.OUTPUT[] = []
        const sr = {
            render(i: InstanceType<ReturnType<typeof StaticRenderInstructions>>) {
                if (i.z_renderBundleCache) {
                    bundles.push(...i.z_renderBundleCache)
                } else {
                    const result = i.callback(srie);
                    if((result as Promise<any>).then){
                        throw new Error("[Cosmos.execStaticSync] Async SRI in execStaticSync, please use execStatic for async RI");
                    }
                    //@ts-ignore
                    bundles.push(...(i.z_renderBundleCache = i.callback(srie)));
                }
            }
        }
        for (const pass of passes) {
            pass.callback(sr);
        }
        const cmdEncoder = this.engineObject.device.createCommandEncoder();
        for (const bundle of bundles) {
            const pass = cmdEncoder.beginRenderPass(bundle.renderPassDescriptor);
            if (bundle.dynamicPrepass) {
                const sridpe = new this.z_SRIDPE(pass, bundle.renderPassDescriptor)
                bundle.dynamicPrepass(sridpe);
            }
            pass.executeBundles([bundle.renderBundle]);
            pass.end();
        }
        this.engineObject.device.queue.submit([cmdEncoder.finish()])
    }

}
import { EngineObjectRaw, EO } from "./eo";
import { DynamicCommandEncoder, DynamicComputeInstructions, DynamicComputeInstructionsEncoder, DynamicPass, DynamicRenderInstructions, DynamicRenderInstructionsEncoder, StaticPass, StaticRenderInstructions, StaticRenderInstructionsDynamicPrepassEncoder, StaticRenderInstructionsEncoder } from "./instructions";
export namespace Cosmos {
    export const EngineObject = EO;
    export type ENGINE_OBJECT = EngineObjectRaw;
    export function supports(feature: WGSL_FEATURES) { return navigator.gpu.wgslLanguageFeatures.has(feature) }
    export type WGSL_FEATURES = "readonly_and_readwrite_storage_textures" | "packed_4x8_integer_dot_product" | "unrestricted_pointer_parameters" | "pointer_composite_access" | "immediate_address_space" | "subgroups" | "subgroups_f16"
}