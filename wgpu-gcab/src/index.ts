export interface GCAB_DESCRIPTOR {
    /** The initial allocation footprint in bytes. */
    byteLength: number;
    /** Extra flags. GPUBufferUsage.COPY_DST is always injected automatically! */
    usageFlags?: number;
    /** Debug label for WebGPU Buffer*/
    label?: string;
    /** Max gap between batches. */
    maxGap?: number;
}
type CHANGES = Record<number, true>
interface CHANGES_BATCH {
    from: number,
    to: number,
}
export class GCAB {
    buffer!: GPUBuffer;
    device;
    ab!: ArrayBuffer;
    uint32!: Uint32Array;
    float32!: Float32Array;
    int32 !: Int32Array;
    desc;
    constructor(device: GPUDevice, descriptor: GCAB_DESCRIPTOR) {
        this.desc = descriptor;
        this.device = device;
        Object.assign(this, GCAB._alloc(device, descriptor));
    }
    static _alloc(device: GPUDevice, desc: GCAB_DESCRIPTOR) {
        const buffer = device.createBuffer({
            label: desc.label,
            size: desc.byteLength,
            usage: GPUBufferUsage.COPY_DST | (desc.usageFlags ?? 0)
        })
        const ab = new ArrayBuffer(desc.byteLength);
        const [int32, uint32, float32] = [new Int32Array(ab), new Uint32Array(ab), new Float32Array(ab)]
        return { buffer, ab, int32, uint32, float32 };
    }
    /** set */
    changes: CHANGES = Object.create(null);

    setF32(index: number, float32: number) {
        this.float32[index] = float32;
        this.changes[index] = true;
    }
    getF32(index: number) {
        return this.float32[index];
    }
    setI32(index: number, int32: number) {
        this.int32[index] = int32;
        this.changes[index] = true;
    }
    getI32(index: number) {
        return this.int32[index]
    }
    setU32(index: number, uint32: number) {
        this.uint32[index] = uint32;
        this.changes[index] = true;
    }
    getU32(index: number) {
        return this.uint32[index]
    }
    static _write(device: GPUDevice, buffer: GPUBuffer, ab: ArrayBuffer, changes: CHANGES, maxGap: number) {
        const sortedIndices = Object.keys(changes).map(a => +a).sort((a, b) => a - b);
        if (sortedIndices.length === 0) return;

        const batches: CHANGES_BATCH[] = [];
        let currentIndex = 0;
        for (const i of sortedIndices) {
            if (!batches[0]) {
                batches[0] = { from: i, to: i };
                continue;
            }
            if ((i - batches[currentIndex].to) > maxGap) {
                batches[++currentIndex] = { from: i, to: i };
                continue;
            } else batches[currentIndex].to = i;
        }
        for (const batch of batches) {
            const byteOffsetFrom = batch.from * 4;
            const elementLength = (batch.to - batch.from) + 1;
            const byteLength = elementLength * 4;
            device.queue.writeBuffer(buffer, byteOffsetFrom, ab,
                byteOffsetFrom, byteLength);
        }
    }
    flush() {
        GCAB._write(this.device, this.buffer, this.ab, this.changes, this.desc.maxGap ?? 20);
        this.changes = {};
    }
    resize(byteLength: number) {
        const oldab = this.ab;
        this.buffer.destroy();
        Object.assign(this, GCAB._alloc(this.device, Object.assign(this.desc, { byteLength })));
        new Uint8Array(this.ab).set(new Uint8Array(oldab));
        const totalElements = Math.floor(oldab.byteLength / 4);
        for (let i = 0; i < totalElements; i++) {
            this.changes[i] = true;
        }
    }
    async syncWithGpu() {
        if (!((this.desc.usageFlags ?? 0) & GPUMapMode.READ)) {
            const stagingBuffer = this.device.createBuffer({
                label: `[${this.desc.label ?? "GCAB"}] Staging Buffer`,
                size: this.desc.byteLength,
                usage: GPUBufferUsage.COPY_DST | GPUMapMode.READ
            });
            const cmdEncoder = this.device.createCommandEncoder({ label: `[${this.desc.label ?? "GCAB"}] Staging` })
            cmdEncoder.copyBufferToBuffer(this.buffer, stagingBuffer);
            this.device.queue.submit([cmdEncoder.finish()]);
            await stagingBuffer.mapAsync(GPUMapMode.READ);
            new Uint8Array(this.ab).set(new Uint8Array(stagingBuffer.getMappedRange()));
            stagingBuffer.unmap();
            stagingBuffer.destroy();
        } else {
            await this.buffer.mapAsync(GPUMapMode.READ);
            new Uint8Array(this.ab).set(new Uint8Array(this.buffer.getMappedRange()));
            this.buffer.unmap();
        }
    }
}