// this was a huge grind ngl
import { EngineObjectRaw } from "./eo";

abstract class CommonInstructions<CALLBACK_FN extends Function>{
    constructor(
       public readonly label: string,
       public readonly callback: CALLBACK_FN
    ){}
}
abstract class CommonRenderInstructionsEncoder {
    z_hasbegan = false;
    abstract z_renderclass?: GPURenderCommandsMixin & GPUBindingCommandsMixin;
    abstract readonly z_classlabel: string;
    z_errorCached?: Error;

    z_assertError(): asserts this is this & { z_renderclass: GPURenderCommandsMixin & GPUBindingCommandsMixin, z_hasbegan: true } {
        if (!this.z_hasbegan || !this.z_renderclass) throw (this.z_errorCached ?? (() => this.z_errorCached = new Error(`[${this.z_classlabel}] Render pass has not yet began`))())
    }
    /**
     * @throws a **`Error`** if the ***renderclass** has not been initialized yet*.
     * @throws a **`Error`** if the ***given pipeline** is invalid*
     */
    pipeline(pipeline: GPURenderPipeline) {
        this.z_assertError();
        if (pipeline.__brand !== "GPURenderPipeline") {
            throw new Error(`[${this.z_classlabel}] Invalid pipeline passed, Expected "GPURenderPipeline" but recieved ${pipeline} with brand ${pipeline.__brand}`);
        }
        this.z_renderclass.setPipeline(pipeline);
        return this;
    }
    /**
     * @throws a **`Error`** if the ***renderclass** has not been initialized yet*.
     * @throws a **`Error`** if the ***vertexBuffer** is invalid*
     */
    vertexBuffer(...args: Parameters<GE<"setVertexBuffer">>) {
        this.z_assertError();
        if (args[1] && !(args[1].usage & GPUBufferUsage.VERTEX)) {
            throw new Error(`[${this.z_classlabel}] Invalid vertex buffer passed, Expected a buffer with GPUBufferUsage.VERTEX`);
        }
        this.z_renderclass.setVertexBuffer(...args);
        return this;
    }
    /**
     * @throws a **`Error`** if the ***renderclass** has not been initialized yet*.
     * @throws a **`Error`** if the ***indexBuffer** is invalid*
     */
    indexBuffer(...args: Parameters<GE<"setIndexBuffer">>) {
        this.z_assertError();
        if (!(args[0].usage & GPUBufferUsage.INDEX)) {
            throw new Error(`[${this.z_classlabel}] Invalid vertex buffer passed, Expected a buffer with GPUBufferUsage.VERTEX`);
        }
        this.z_renderclass.setIndexBuffer(...args);
        ; return this
    }

    z_common<FN extends "draw" | "drawIndexed" | "drawIndexedIndirect" | "drawIndirect" | "setImmediates" | "setBindGroup">(fn: FN, args: Parameters<GE<FN>>) {
        this.z_assertError();
        // @ts-ignore
        this.z_renderclass[fn](...args);
        return this
    }
    /**
     * @throws a **`Error`** if the ***renderclass** has not been initialized yet*.
     */
    draw(...args: Parameters<GE<"draw">>) { this.z_common("draw", args); return this }
    /**
     * @throws a **`Error`** if the ***renderclass** has not been initialized yet*.
     * @throws a **`Error`** if the ***given buffer** is invalid*
     */
    drawIndirect(...args: Parameters<GE<"drawIndirect">>) { if (!(args[0].usage & GPUBufferUsage.INDIRECT)) throw new Error(`[${this.z_classlabel}] Given buffer doesn't have the flag GPUBufferUsage.INDIRECT`); this.z_common("drawIndirect", args); return this }
    /**
     * @throws a **`Error`** if the ***renderclass** has not been initialized yet*.
     * @throws a **`Error`** if the ***given buffer** is invalid*
     */
    drawIndexedIndirect(...args: Parameters<GE<"drawIndexedIndirect">>) { if (!(args[0].usage & GPUBufferUsage.INDIRECT)) throw new Error(`[${this.z_classlabel}] Given buffer doesn't have the flag GPUBufferUsage.INDIRECT`); this.z_common("drawIndexedIndirect", args); return this }
    /**
     * @throws a **`Error`** if the ***renderclass** has not been initialized yet*.
     * 
     */
    drawIndexed(...args: Parameters<GE<"drawIndexed">>) { this.z_common("drawIndexed", args); return this }
    /**
     * @throws a **`Error`** if the ***renderclass** has not been initialized yet*.
     * @throws a **`Error`** if the ***bindgroup** is invalid*
     */
    bindGroup(...args: Parameters<GE<"setBindGroup">>) { if (args[1] && args[1]?.__brand !== "GPUBindGroup") throw new Error(`[${this.z_classlabel}] Given bind group is invalid`); this.z_common("setBindGroup", args); return this }
    /**
     * @throws a **`Error`** if the ***renderclass** has not been initialized yet*.
     */
    immediates(...args: Parameters<GE<"setImmediates">>) { this.z_common("setImmediates", args); return this }
}
abstract class RenderPassEncoderExt extends CommonRenderInstructionsEncoder {
    /**
         * @throws a `Error` if ***renderpass** has not yet began*
         */
        scissorRect(...args: Parameters<GPURenderPassEncoder["setScissorRect"]>) {
            this.z_assertError();
            // @ts-ignore
            this.z_renderclass.setScissorRect(...args);
            return this
        }
        /**
         * @throws a `Error` if ***renderpass** has not yet began*
         */
        stencilReference(...args: Parameters<GPURenderPassEncoder["setStencilReference"]>) {
            this.z_assertError();
            // @ts-ignore
            this.z_renderclass.setStencilReference(...args);
            return this
        }
        /**
         * @throws a `Error` if ***renderpass** has not yet began*
         */
        viewport(...args: Parameters<GPURenderPassEncoder["setViewport"]>) {
            this.z_assertError();
            // @ts-ignore
            this.z_renderclass.setViewport(...args);
            return this
        }
        /**
         * @throws a `Error` if ***renderpass** has not yet began*
         */
        blendConstant(color: GPUColor) {
            this.z_assertError()
            // @ts-ignore
            this.z_renderclass.setBlendConstant(color);
            return this
        }
        /**
         * See {@link GPURenderPassEncoder.setImmediates}
         * @throws a `Error` if ***renderpass** has not yet began*
         */
        immediates(...args: Parameters<typeof GPURenderBundleEncoder["prototype"]["setImmediates"]>) {
            this.z_assertError();
            // @ts-ignore
            this.z_renderclass.setImmediates(...args);
            return this
        }
        z_descriptor?: GPURenderPassDescriptor;
        z_startedOcculsionQuery?: boolean = false;
        /**
         * See {@link GPURenderPassEncoder.beginOcclusionQuery}
         * @throws a `Error` if you *haven't began a **render pass***.
         * @throws a `Error` if you *have already began a **occlusionQuery***
         * @throws a `Error` if you *didn't provide a **occulsionQuerySet** when beginning a renderpass*
         */
        beginOcclusionQuery(queryIndex: GPUSize32) {
            this.z_assertError();
            if (!this.z_descriptor) return;
            if (this.z_startedOcculsionQuery) throw new Error("[Cosmos.DynamicRenderInstructionEncoder] Occlusion Query has already started!")
            if (!this.z_descriptor.occlusionQuerySet) throw new Error("[Cosmos.DynamicRenderInstructionEncoder] You haven't provided a occlusionQuerySet!");
            // @ts-ignore
            this.z_renderclass.beginOcclusionQuery(queryIndex);
            this.z_startedOcculsionQuery = true;
            return this;
        }
        /**
         * See {@link GPURenderPassEncoder.endOcclusionQuery}
         * @throws a `Error` if you *haven't began a **render pass***
         * @throws a `Error` if you *haven't began a **occlusion query***
         */
        endOcclusionQuery() {
            this.z_assertError()
            if (!this.z_startedOcculsionQuery) throw new Error("[Cosmos.DynamicRenderInstructionEncoder] Occlusion Query has not started yet.");
            // @ts-ignore
            this.z_startedOcculsionQuery = this.z_renderclass.endOcclusionQuery() as unknown as boolean;
            return this;
        }
}
type GE<T extends keyof (GPURenderCommandsMixin & GPUBindingCommandsMixin)> = (GPURenderCommandsMixin & GPUBindingCommandsMixin)[T]
type P<A extends (args: any) => any> = Parameters<A>;
export function DynamicRenderInstructions(eo: EngineObjectRaw) {
    return class DynamicRenderInstructions  extends CommonInstructions<DynamicRenderInstructions.CALLBACK>{
    }
}
export namespace DynamicRenderInstructions {
    export type INSTRUCTIONS_ENCODER = InstanceType<ReturnType<typeof DynamicRenderInstructionsEncoder>>
    export type COMMAND_ENCODER = InstanceType<ReturnType<typeof DynamicCommandEncoder>>;
    export type CALLBACK = (encoder: INSTRUCTIONS_ENCODER, cmdEncoder: COMMAND_ENCODER) => any
}

export function DynamicRenderInstructionsEncoder(eo: EngineObjectRaw) {
    return class DynamicRenderInstructionsEncoder extends RenderPassEncoderExt {
        z_renderclass!: GPURenderPassEncoder;
        z_classlabel: string = "Cosmos.DynamicRenderInstructionsEncoder";
        constructor(public z_commandEncoder: GPUCommandEncoder) { super() };
        /**
         * Begins a **RenderPass**.
         * 
         * @throws a `Error` if the ***renderpass** has already began*
         */
        begin(
            descriptor: GPURenderPassDescriptor
        ) {
            if (eo.lost) {
                throw new Error("[Cosmos.DynamicRenderInstructionEncoder] Device is lost.")
            }
            if (this.z_hasbegan) {
                throw new Error("[Cosmos.DynamicRenderInstructionEncoder] Encoder has already began")
            }
            this.z_hasbegan = true;
            this.z_descriptor = descriptor;
            this.z_renderclass = this.z_commandEncoder.beginRenderPass(descriptor);
            return this;
        }
        end() {
            this.z_hasbegan = false;
            this.z_descriptor = undefined;
            if (this.z_startedOcculsionQuery) {
                this.z_renderclass.endOcclusionQuery();
            }
            return this.z_renderclass.end()
        }
    }
}
export namespace DynamicRenderInstructionsEncoder {
    // i lwk couldn't think of a smaller name
    export interface BEGIN_DESCRIPTOR extends GPURenderPassDescriptor {
        /**Preinit **Render Pipeline.** */
        pipeline?: GPURenderPipeline,
        blendConstant?: GPUColor,
    }
}
export function DynamicCommandEncoder(eo: EngineObjectRaw) {
    return class DynamicCommandEncoder {
        constructor(public readonly commandEncoder: GPUCommandEncoder) { }

        clearBuffer(
            ...args: Parameters<GPUCommandEncoder["clearBuffer"]>
        ) {
            this.commandEncoder.clearBuffer(...args);
            return this;
        }

        copyBufferToBuffer(
            ...args: Parameters<GPUCommandEncoder["copyBufferToBuffer"]>
        ) {
            this.commandEncoder.copyBufferToBuffer(...args);
            return this;
        }

        copyBufferToTexture(
            ...args: Parameters<GPUCommandEncoder["copyBufferToTexture"]>
        ) {
            this.commandEncoder.copyBufferToTexture(...args);
            return this;
        }

        copyTextureToBuffer(
            ...args: Parameters<GPUCommandEncoder["copyTextureToBuffer"]>
        ) {
            this.commandEncoder.copyTextureToBuffer(...args);
            return this;
        }

        copyTextureToTexture(
            ...args: Parameters<GPUCommandEncoder["copyTextureToTexture"]>
        ) {
            this.commandEncoder.copyTextureToTexture(...args);
            return this;
        }

        resolveQuerySet(
            ...args: Parameters<GPUCommandEncoder["resolveQuerySet"]>
        ) {
            this.commandEncoder.resolveQuerySet(...args);
            return this;
        }

        finish(...args: Parameters<GPUCommandEncoder["finish"]>) {
            return this.commandEncoder.finish(...args);
        }
    };
}
export function DynamicComputeInstructionsEncoder(eo: EngineObjectRaw) {
    return class DynamicComputeInstructionsEncoder {
        constructor(public z_cmdenc: GPUCommandEncoder) { };
        z_hasbegan = false;
        z_computePass!: GPUComputePassEncoder
        begin(descriptor: GPUComputePassDescriptor) {
            if (this.z_hasbegan) {
                throw new Error("[Cosmos.DynamicComputeInstructionsEncoder] Encoder has already began");
            }
            this.z_hasbegan = true;
            this.z_computePass = this.z_cmdenc.beginComputePass(descriptor);
            this.z_computePass
        }
        z_beganError() { if (!this.z_hasbegan) throw new Error("[Cosmos.DynamicComputeInstructionsEncoder] Encoder has not began!") }
        /**
         *  @throws a `Error` if the compute pass hasnt started yet
         */
        dispatchWorkgroups(...args: Parameters<GPUComputePassEncoder["dispatchWorkgroups"]>) {
            this.z_beganError();
            this.z_computePass.dispatchWorkgroups(...args)
        }
        /**
         *  @throws a `Error` if the compute pass hasnt started yet
         */
        dispatchWorkgroupsIndirect(...args: Parameters<GPUComputePassEncoder["dispatchWorkgroupsIndirect"]>) {
            this.z_beganError();
            this.z_computePass.dispatchWorkgroupsIndirect(...args)
        }
        /**
         *  @throws a `Error` if the compute pass hasnt started yet
         */
        immediates(...args: Parameters<GPUComputePassEncoder["setImmediates"]>) {
            this.z_beganError();
            this.z_computePass.setImmediates(...args)
        }
        /**
         *  @throws a `Error` if the compute pass hasnt started yet
         */
        bindGroup(...args: Parameters<GPUComputePassEncoder["setBindGroup"]>) {
            this.z_beganError();
            this.z_computePass.setBindGroup(...args);
        }
        /**
         * Sets pipeline.
         * @throws a `Error` if the compute pass hasnt started yet
         */
        pipeline(pipeline: GPUComputePipeline) {
            this.z_beganError();
            this.z_computePass.setPipeline(pipeline);
        }
        /**
         *  @throws a `Error` if the compute pass hasnt started yet
         */
        end() {
            this.z_beganError();
            this.z_computePass.end();
            this.z_hasbegan = false;
        }
    }
}
export function DynamicComputeInstructions(eo: EngineObjectRaw) {
    return class DynamicComputeInstructions extends CommonInstructions<DynamicComputeInstructions.CALLBACK> {}
}
export namespace DynamicComputeInstructions {
    export type INSTRUCTIONS_ENCODER = InstanceType<ReturnType<typeof DynamicComputeInstructionsEncoder>>
    export type COMMAND_ENCODER = InstanceType<ReturnType<typeof DynamicCommandEncoder>>;
    export type CALLBACK = (encoder: INSTRUCTIONS_ENCODER, cmdEncoder: COMMAND_ENCODER) => any
}
export function StaticRenderInstructionsEncoder(eo: EngineObjectRaw) {
    return class StaticRenderInstructionsEncoder extends CommonRenderInstructionsEncoder {
        constructor() { super() };
        z_hasbegan = false;
        z_classlabel: string = "Cosmos.StaticRenderInstructionsEncoder";
        /**I swear if you touch this you're getting sent to the ***void*** */
        z_renderclass!: GPURenderBundleEncoder
        z_descriptor?: StaticRenderInstructionsEncoder.BEGIN_DESCRIPTOR
        z_rpdesc?: GPURenderPassDescriptor
        /**
         * Begins a **RenderPass**.
         * 
         * @throws a `Error` if the ***renderpass** has already began*
         */
        begin(
            descriptor:
                StaticRenderInstructionsEncoder.BEGIN_DESCRIPTOR,
            renderPassDescriptor: GPURenderPassDescriptor
        ) {
            if (eo.lost) {
                throw new Error("[Cosmos.StaticRenderInstructionEncoder] Device is lost.")
            }
            if (this.z_hasbegan) {
                throw new Error("[Cosmos.StaticRenderInstructionEncoder] Encoder has already began")
            }
            this.z_hasbegan = true;
            this.z_descriptor = descriptor;
            this.z_rpdesc = renderPassDescriptor;
            this.z_renderclass = eo.device.createRenderBundleEncoder(descriptor);
            if (descriptor.pipeline) this.z_renderclass.setPipeline(descriptor.pipeline)
            return this;
        }
        end(dynamicPrepass?: StaticRenderInstructionsEncoder.DYNAMIC_PREPASS): StaticRenderInstructionsEncoder.OUTPUT {
            this.z_hasbegan = false;
            this.z_descriptor = undefined;
            return { renderBundle: this.z_renderclass.finish(), renderPassDescriptor: this.z_rpdesc as GPURenderPassDescriptor, dynamicPrepass};
        }
    }
}
export namespace StaticRenderInstructionsEncoder {
    // i lwk couldn't think of a smaller name
    export interface BEGIN_DESCRIPTOR extends GPURenderBundleEncoderDescriptor {
        /**Preinit **Render Pipeline.** */
        pipeline?: GPURenderPipeline,
    }
    export interface OUTPUT {
        renderBundle: GPURenderBundle,
        renderPassDescriptor: GPURenderPassDescriptor,
        dynamicPrepass?: DYNAMIC_PREPASS;
    }
    export type DYNAMIC_PREPASS = (prepassEncoder: InstanceType<ReturnType<typeof StaticRenderInstructionsDynamicPrepassEncoder>>) => any
}
export function StaticRenderInstructions(eo: EngineObjectRaw) {
    return class StaticRenderInstructions extends CommonInstructions<StaticRenderInstructions.CALLBACK>{
        z_renderBundleCache?: StaticRenderInstructionsEncoder.OUTPUT[]
    }
}
export function StaticRenderInstructionsDynamicPrepassEncoder(eo: EngineObjectRaw){
    return class StaticRenderInstructionsDynamicPrepassEncoder extends RenderPassEncoderExt {
        constructor(
            renderpass: GPURenderPassEncoder,
            desc: GPURenderPassDescriptor
        ){
            super();
            this.z_renderclass = renderpass;
            this.z_descriptor = desc;
            this.z_hasbegan = true;
        }
        z_renderclass: GPURenderPassEncoder;
        z_classlabel: string = "Cosmos.StaticRenderInstructionEncoderDynamicPrepass"; 
    }
}
export namespace StaticRenderInstructions {
    export type INSTRUCTIONS_ENCODER = InstanceType<ReturnType<typeof StaticRenderInstructionsEncoder>>
    export type CALLBACK = (encoder: INSTRUCTIONS_ENCODER) => StaticRenderInstructionsEncoder.OUTPUT[] | Promise<StaticRenderInstructionsEncoder.OUTPUT[]>
}
export namespace Pass {
    export interface DynamicComputer {
        compute(instruction: InstanceType<ReturnType<typeof DynamicComputeInstructions>>): void;
    }
    export interface DynamicRenderer {
        render(instruction: InstanceType<ReturnType<typeof DynamicRenderInstructions>>): void;
    }
    export interface StaticRenderer {
        render(instruction: InstanceType<ReturnType<typeof StaticRenderInstructions>>): void;
    }
    export type DynamicPassCallback = (renderer: DynamicRenderer, computer: DynamicComputer) => void | Promise<void>;
    export type StaticPassCallback = (renderer: StaticRenderer) => void | Promise<void>;
}
abstract class CommonPass<CALLBACK_FN extends Function> {
    constructor(
        public label: string,
        public callback: CALLBACK_FN
    ){}
}
export function DynamicPass(eo: EngineObjectRaw) {
    return class DynamicPass extends CommonPass<Pass.DynamicPassCallback>{}
}
export function StaticPass(eo: EngineObjectRaw) {
    return class StaticPass extends CommonPass<Pass.StaticPassCallback>{}
}