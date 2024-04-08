export const fromBase64 = (str: string) =>
    new Uint8Array(
        atob(str)
            .split("")
            .map((c) => c.charCodeAt(0))
    )


// export function arrayBufferToBase64(buffer: ArrayBuffer) {
//     let binary = '';
//     const bytes = new Uint8Array(buffer);
//     const len = bytes.byteLength;
//     for (let i = 0; i < len; i++) {
//         binary += String.fromCharCode(bytes[i]);
//     }
//     return btoa(binary);
// }

export const arrayBufferToBase64 = (arr: any) => Buffer.from(arr).toString("base64")

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = Buffer.from(base64, 'base64')
    return binaryString
}
