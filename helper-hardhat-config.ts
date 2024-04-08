export interface networkConfigItem {
    name?: string
    callbackGasLimit?: string
    blockConfirmations?: number
    functionsRouter?: string
    functionsSubscriptionId?: string
    rpcUrl?: string
    functionsDonId?: string
    gasLimit?: number
    explorerUrl?: string
    linkToken?: string
    usdcAddress?: string
}

export interface networkConfigInfo {
    [key: number]: networkConfigItem
}

export const networkConfig: networkConfigInfo = {
    31337: {
        name: "localhost",
        callbackGasLimit: "500000", // 500,000 gas
        blockConfirmations: 1,
        functionsRouter: "0x6E2dc0F9DB014aE19888F539E59285D2Ea04244C",
        functionsSubscriptionId: process.env.SUBSCRIPTION_ID,
        functionsDonId: "fun-localhost-1",
    },
    80001: {
        name: "mumbai",
        blockConfirmations: 6,
        functionsRouter: "0x6E2dc0F9DB014aE19888F539E59285D2Ea04244C",
        functionsSubscriptionId: process.env.SUBSCRIPTION_ID,
        functionsDonId: "fun-polygon-mumbai-1",
        gasLimit: 300000,
        explorerUrl: "https://mumbai.polygonscan.com",
        linkToken: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
        usdcAddress: "0x52D800ca262522580CeBAD275395ca6e7598C014"
    },
    43113: {
        name: "fuji",
        blockConfirmations: 6,
        functionsRouter: "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0",
        functionsSubscriptionId: process.env.SUBSCRIPTION_ID,
        rpcUrl: process.env.AVALANCHE_FUJI_RPC_URL,
        functionsDonId: "fun-avalanche-fuji-1",
        gasLimit: 300000,
        explorerUrl: "https://testnet.avascan.info/",
        linkToken: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",
        usdcAddress: "0xCaC7Ffa82c0f43EBB0FC11FCd32123EcA46626cf"
    },
    1: {
        name: "mainnet",
    },
}

export const developmentChains = ["mumbai"]

export const frontEndContractsFile = "../Frontend/contracts/contractAddresses.json"
export const frontEndAbiLocation = "../Frontend/contracts/"
