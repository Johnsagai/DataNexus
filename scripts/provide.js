function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
}

function arrayBufferToBase64(buffer) {
    let binary = ""
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
}

function splitBase64IntoChunks(base64String, byteChunkSize) {
    // Calculate the number of Base64 characters per chunk of binary data
    const chunks = []
    for (let i = 0; i < base64String.length; i += byteChunkSize) {
        const chunk = base64String.substring(i, i + byteChunkSize)
        chunks.push(chunk)
    }

    return chunks
}

const toBase64 = (arr) => btoa(String.fromCodePoint(...arr))

const fromBase64 = (str) =>
    new Uint8Array(
        atob(str)
            .split("")
            .map((c) => c.charCodeAt(0))
    )

let enc = new TextEncoder()
let dec = new TextDecoder()

const token_key = base64ToArrayBuffer(secrets.token_key)

const importedKey = await crypto.subtle.importKey(
    "pkcs8",
    token_key,
    {
        name: "RSA-OAEP",
        hash: "SHA-256",
    },
    true,
    ["decrypt"]
)

const encrypted_token = base64ToArrayBuffer(args[0])

const accessToken = dec.decode(
    await crypto.subtle.decrypt(
        {
            name: "RSA-OAEP",
        },
        importedKey,
        encrypted_token
    )
)

const dataKey = args[1]
const dataPubKey = await crypto.subtle.importKey(
    "spki",
    fromBase64(dataKey),
    {
        name: "RSA-OAEP",
        hash: "SHA-256",
    },
    true,
    ["encrypt"]
)

const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
])
const iv = crypto.getRandomValues(new Uint8Array(12)) // Initialization vector for AES
// Build the HTTP request object for Google Fitness API
const googleFitnessRequest = Functions.makeHttpRequest({
    url: "https://www.googleapis.com/fitness/v1/users/me/sessions",
    headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
    },
})

const googleFitnessResponse = await googleFitnessRequest

if (googleFitnessResponse.error) {
    throw new Error("GoogleFitness Error")
}

const googleFitnessData = enc.encode(JSON.stringify(googleFitnessResponse.data))

const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    googleFitnessData
)
const exportedAesKey = await crypto.subtle.exportKey("raw", aesKey)
const encryptedAesKey = await crypto.subtle.encrypt("RSA-OAEP", dataPubKey, exportedAesKey)
const encryptedIv = await crypto.subtle.encrypt("RSA-OAEP", dataPubKey, iv)
const chunkData = splitBase64IntoChunks(arrayBufferToBase64(encryptedData), 2000)

const dataCids = []
for (let i = 0; i < chunkData.length; i++) {
    const dataStorageRequest = Functions.makeHttpRequest({
        url: "https://api.nft.storage/upload",
        method: "POST",
        headers: {
            "Content-Type": "*",
            Authorization: "Bearer " + secrets.ipfsAuth,
        },
        data: {
            data: chunkData[i],
        },
    })
    const dataStorageResponse = await dataStorageRequest

    if (dataStorageResponse.error) {
        console.log(dataStorageResponse)
        throw new Error("Data Storage: NFT.storage Error", dataStorageResponse)
    }

    dataCids.push(dataStorageResponse.data.value.cid)
}

const aesKeyStorageRequest = Functions.makeHttpRequest({
    url: "https://api.nft.storage/upload",
    method: "POST",
    headers: {
        "Content-Type": "*",
        Authorization: "Bearer " + secrets.ipfsAuth,
    },
    data: {
        aesKey: arrayBufferToBase64(encryptedAesKey),
        iv: arrayBufferToBase64(encryptedIv),
        dataCids: dataCids,
    },
})

const aesKeyStorageResponse = await aesKeyStorageRequest

if (aesKeyStorageResponse.error) {
    console.log(aesKeyStorageResponse)
    throw new Error("Aes Key: NFT.storage Error")
}

return enc.encode(aesKeyStorageResponse.data.value.cid)
