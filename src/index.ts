
export enum LENGTH {
    BIT8 = 1,
    BIT16 = 2,
    BIT32 = 4
}
export const WGPU_DATA_TYPE = {
    /**Represents a U8 (1 byte) */
    U8: { type: "uint", length: LENGTH.BIT8 },
    /**Represents a U16 (2 byte) */
    U16: { type: "uint", length: LENGTH.BIT16 },
    /**Represents a U32 (4 byte) */
    U32: { type: "uint", length: LENGTH.BIT32 },
    /**Represent a I8 (1 byte) */
    I8: { type: "int", length: LENGTH.BIT8 },
    /**Represent a I16 (2 byte) */
    I16: { type: "int", length: LENGTH.BIT16 },
    /**Represent a I32 (4 byte) */
    I32: { type: "int", length: LENGTH.BIT32 },
    /**Represent a F16 (2 byte) */
    F16: { type: "float", length: LENGTH.BIT16 },
    /**Repesent a F32 (4 byte) */
    F32: { type: "float", length: LENGTH.BIT32 }
} as const;
export type WGPU_DATA_TYPE = typeof WGPU_DATA_TYPE[keyof typeof WGPU_DATA_TYPE]
export interface TYPE_METADATA {
    /**
     * Represents the length of the type.
     * 
     * e.g. **`length: 4`** meaning it's a **`array<yourType, 4>`**
     */
    length: number,
    /**
     * Represents the webgpu type;
     * 
     * e.g. **`WGPU_DATA_TYPE.U8`** represents a **Uint8 [0-256]**
     */
    type: WGPU_DATA_TYPE
}

export type FIELD = ({
    /**Name of the field */
    name: string,
    required: boolean,
}) & (({
    /**
     * The type of the field;
     * 
     * If you want to represent a vec3i; use `{length: 3, type: WGPU_DATA_TYPE.I32}`
     */
    type: TYPE_METADATA;
}) | ({
    /**
     * Inner struct
     */
    innerStruct: WGPU_STRUCT;
    length: number;
}))

export type WGPU_STRUCT = FIELD[];
export type DIGESTABLE_FIELD = {
    name: string;
    length: number;
    required: boolean;
} & (
        { struct: DIGESTABLE_STRUCT_LAYOUT } | { type: WGPU_DATA_TYPE }
    )
export interface DIGESTABLE_STRUCT_LAYOUT {
    byteLength: number;
    items: DIGESTABLE_FIELD[];
}
export interface DATA_TYPE {
    [x: string]: number[] | DATA_TYPE[]
}
export namespace StructValidation {
    export function validateNames(struct: WGPU_STRUCT) {
        let set: Record<string, true> = {};
        for (const field of struct) {
            if (set[field.name]) throw new Error("Duplicate field name " + field.name)
            else if ((field as { name: string } & { innerStruct: WGPU_STRUCT })?.innerStruct) validateNames((field as { name: string } & { innerStruct: WGPU_STRUCT }).innerStruct)
            set[field.name] = true;
        }
        set = {}
    }
    function getByteLength(struct: WGPU_STRUCT) {
        let bytes = 0;
        for (const field of struct) {
            const assingleTyped = (field as { name: string } & { type: TYPE_METADATA })
            if (assingleTyped.type) {
                bytes += assingleTyped.type.type.length * assingleTyped.type.length
            }
            const asstructTyped = (field as { name: string } & { innerStruct: WGPU_STRUCT; length: number })
            if (asstructTyped.innerStruct) {
                bytes += asstructTyped.length * getByteLength(asstructTyped.innerStruct);
            }
        }
        return bytes;
    }
    export function validateBytelength(struct: WGPU_STRUCT) {
        const byteLength = getByteLength(struct);
        if (byteLength % 4 !== 0) {
            throw new Error(`Length of the given struct is not divisible by 4.`);
        }
        if (byteLength % 16 !== 0) {
            throw new Error(`Length of the given struct is not divisble by 16`);
        }
    }
    export function validateData(data: DATA_TYPE, layout: DIGESTABLE_STRUCT_LAYOUT) {
        for (const field of layout.items) {
            const fieldData = data[field.name];
            if (!fieldData && field.required) throw new Error(`Error while validating data: "${field.name}" not given`);
            if (fieldData.length !== field.length) throw new Error(`[Field "${field.name}"]: Given data is of ${fieldData.length} where as ${field.length} is required.`);
            const asTyped = field as { name: string } & { type: WGPU_DATA_TYPE };
            if (asTyped.type) {
                if (fieldData.every(a => typeof a !== "number")) {
                    throw new Error(`[Field "${field.name}"]: Array given is not of number[] type`)
                }
            } else {
                for (const data of fieldData) {
                    validateData(data as DATA_TYPE, (field as { struct: DIGESTABLE_STRUCT_LAYOUT }).struct)
                }
            }
        }
    }
}
export namespace StructConverter {
    export function convertToDigestableLayout(struct: WGPU_STRUCT) {
        const layout: DIGESTABLE_STRUCT_LAYOUT = { byteLength: 0, items: [] };
        for (const field of struct) {
            const fieldTyped = field as ({ name: string } & { type: TYPE_METADATA, required: boolean });
            const fieldStruct = field as ({ name: string } & { innerStruct: WGPU_STRUCT, length: number, required: boolean });
            if (fieldTyped.type) {
                const byteLength = fieldTyped.type.type.length * fieldTyped.type.length;
                layout.byteLength += byteLength;
                layout.items.push({ "length": fieldTyped.type.length, "name": fieldTyped.name, "type": fieldTyped.type.type, required: fieldTyped.required })
            } else if (fieldStruct.innerStruct) {
                const digested = convertToDigestableLayout(fieldStruct.innerStruct);
                const byteLength = fieldStruct.length * digested.byteLength;
                layout.byteLength += byteLength;
                layout.items.push({ length: fieldStruct.length, name: fieldStruct.name, struct: digested, required: fieldStruct.required });
            }
        }
        return layout;
    }
}

export namespace Packer {
    /** Packs data to {type: "f32"|"i32"|"u32", value: number}[] */
    export function packToBit32(data: DATA_TYPE, layout: DIGESTABLE_STRUCT_LAYOUT) {
        const buffer = new ArrayBuffer(layout.byteLength);
        const view = new DataView(buffer);
        
        const chunkTypes: ("f32" | "i32" | "u32")[] = new Array(layout.byteLength / 4).fill("u32");
        
        let byteOffset = 0;

        function writeField(fieldData: number[] | DATA_TYPE[], field: DIGESTABLE_FIELD) {
            const isPrimitive = "type" in field;

            if (isPrimitive) {
                const primitiveType = field.type.type; 
                const bitLength = field.type.length; 
                const numericArray = fieldData as number[];

                for (let i = 0; i < field.length; i++) {
                    const value = numericArray[i] ?? 0;
                    const chunkIndex = Math.floor(byteOffset / 4);
                    if (primitiveType === "float") chunkTypes[chunkIndex] = "f32";
                    else if (primitiveType === "int") chunkTypes[chunkIndex] = "i32";

                    if (primitiveType === "uint") {
                        if (bitLength === 1) view.setUint8(byteOffset, value);
                        else if (bitLength === 2) view.setUint16(byteOffset, value, true);
                        else if (bitLength === 4) view.setUint32(byteOffset, value, true);
                    } else if (primitiveType === "int") {
                        if (bitLength === 1) view.setInt8(byteOffset, value);
                        else if (bitLength === 2) view.setInt16(byteOffset, value, true);
                        else if (bitLength === 4) view.setInt32(byteOffset, value, true);
                    } else if (primitiveType === "float") {
                        if (bitLength === 4) view.setFloat32(byteOffset, value, true);
                    }

                    byteOffset += bitLength;
                }
            } else {
                const structArray = fieldData as DATA_TYPE[];
                const innerLayout = field.struct;

                for (let i = 0; i < field.length; i++) {
                    const innerData = structArray[i] ?? {};
                    for (const innerField of innerLayout.items) {
                        writeField(innerData[innerField.name], innerField);
                    }
                }
            }
        }

        for (const item of layout.items) {
            writeField(data[item.name], item);
        }

        const result: { type: "f32" | "i32" | "u32"; value: number }[] = [];
        const total32BitChunks = layout.byteLength / 4;

        for (let i = 0; i < total32BitChunks; i++) {
            const currentByteOffset = i * 4;
            const targetType = chunkTypes[i];
            let value = 0;

            if (targetType === "f32") {
                value = view.getFloat32(currentByteOffset, true);
            } else if (targetType === "i32") {
                value = view.getInt32(currentByteOffset, true);
            } else {
                value = view.getUint32(currentByteOffset, true);
            }

            result.push({ type: targetType, value });
        }

        return result;
    }
}