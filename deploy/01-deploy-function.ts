import { HardhatRuntimeEnvironment } from "hardhat/types"
const { ethers: ethersv5 } = require("ethers-v5")
import fs from 'fs';
import {
    SubscriptionManager,
    SecretsManager,
    simulateScript,
    ResponseListener,
    ReturnType,
    decodeResult,
    createGist,
    deleteGist,
    FulfillmentCode,
} from "@chainlink/functions-toolkit";
import { DataListingFactory, ERC20Token } from "../typechain-types"

import { networkConfig } from "../helper-hardhat-config"
import { DeployFunction } from "hardhat-deploy/types"
import * as crypto from "crypto"
import { EventLog } from "ethers";
import { encryptSecrets, addConsumer } from "../scripts/encryptSecrets";

const toBase64 = (arr: Uint8Array) => btoa(String.fromCodePoint(...arr))

const deployFunctions: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network, ethers } = hre
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const chainId = network.config.chainId || 31337

    const functionRouterAddress = networkConfig[chainId].functionsRouter!
    let token: any, tokenAddress: string

    log("----------------------------------------------------")

    if (chainId != 31337) {
        const accounts = await ethers.getSigners()
        tokenAddress = networkConfig[chainId].usdcAddress!
        const tokenAbi = fs.readFileSync("./abis/erc20Abi.abi.json", "utf8")
        token = new ethers.Contract(
            tokenAddress,
            tokenAbi,
            accounts[0],
        )
    } else {
        await deploy("ERC20Token", {
            from: deployer,
            args: ["1000000000000000000000000"],
            log: true,
            waitConfirmations: networkConfig[chainId].blockConfirmations || 1,
        })

        token = await ethers.getContract("ERC20Token", deployer)
        tokenAddress = await token.getAddress();
    }

    await deploy("DataListingFactory", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: networkConfig[chainId].blockConfirmations || 1,
    })

    log("----------------------------------------------------")
    console.log(networkConfig[chainId])

    const provideScript = fs.readFileSync("scripts/provide.js", "utf-8"); // TODO: use real script

    // API Key Encryption
    const tokenKeyPair = await crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"],
    );
    const exportedTokenPublicKey = await crypto.subtle.exportKey("spki", tokenKeyPair.publicKey);
    const exportedTokenPrivateKey = await crypto.subtle.exportKey("pkcs8", tokenKeyPair.privateKey);

    const tokenPubKey = toBase64(new Uint8Array(exportedTokenPublicKey))
    const tokenPrivKey = toBase64(new Uint8Array(exportedTokenPrivateKey))

    // Data Encryption
    const dataKeyPair = await crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"],
    );
    const exportedDataPublicKey = await crypto.subtle.exportKey("spki", dataKeyPair.publicKey);
    const exportedDataPrivateKey = await crypto.subtle.exportKey("pkcs8", dataKeyPair.privateKey);

    const dataPubKey = toBase64(new Uint8Array(exportedDataPublicKey))
    const dataPrivKey = toBase64(new Uint8Array(exportedDataPrivateKey)) // TODO: give to user

    const secrets = {
        token_key: tokenPrivKey,
        ipfsAuth: process.env.NFT_STORAGE_API_TOKEN!,
    }

    const dataKeyPath = './test/helper/dataKey.txt';
    fs.writeFileSync(dataKeyPath, dataPrivKey);

    const privateKey = process.env.PRIVATE_KEY; // fetch PRIVATE_KEY
    if (!privateKey)
        throw new Error(
            "private key not provided - check your environment variables"
        );

    const githubApiToken = process.env.GITHUB_API_TOKEN;
    if (!githubApiToken)
        throw new Error(
            "githubApiToken not provided - check your environment variables"
        );

    let encryptedSecretsUrls
    let signer
    if (chainId != 31337) {
        const rpcUrl = process.env.POLYGON_MUMBAI_RPC_URL; // fetch mumbai RPC URL

        if (!rpcUrl)
            throw new Error(`rpcUrl not provided  - check your environment variables`);

        const wallet = new ethersv5.Wallet(privateKey);
        const provider = new ethersv5.providers.JsonRpcProvider(rpcUrl);
        signer = wallet.connect(provider); // create ethers signer for signing transactions

        encryptedSecretsUrls = await encryptSecrets(chainId, signer, secrets)
    } else {
        console.log(`Creating gist...`);

        const secretsFilePath = './test/helper/secrets.json';

        fs.writeFileSync(secretsFilePath, JSON.stringify(secrets));

        const gistURL = await createGist(
            githubApiToken,
            JSON.stringify(secrets)
        );
        console.log(`\n✅Gist created ${gistURL} . Encrypting the URLs..`);
        const encoder = new TextEncoder();
        const data = encoder.encode(gistURL);
        encryptedSecretsUrls = data
    }

    log("----------------------------------------------------")

    const dataListingFactory: DataListingFactory = await ethers.getContract("DataListingFactory", deployer)
    const dataListingFactoryAddress = await dataListingFactory.getAddress()

    log("Approving tokens to Data Listing Factory...")
    const listingBalance = 100000000n
    const approveTx = await token.approve(dataListingFactoryAddress, listingBalance)
    await approveTx.wait()
    log("✅Tokens approved")

    log("Creating new Data Listing...")
    const createTx = await dataListingFactory.createDataListing(
        functionRouterAddress,
        provideScript,
        tokenPubKey,
        dataPubKey,
        encryptedSecretsUrls,
        "GoogleFit",
        tokenAddress,
        listingBalance,
        100n,
    )

    const createTxReceipt = await createTx.wait(1) // Wait for the transaction to be mined
    const logs = createTxReceipt!.logs as EventLog[]
    const dataListingAddress = logs[0].args[0].toString();

    log("✅Data Listing created at: ", dataListingAddress);

    if (chainId != 31337) {
        await addConsumer(chainId, signer, dataListingAddress)
    }

    log("----------------------------------------------------");
}
export default deployFunctions
deployFunctions.tags = ["all", "functions"]
