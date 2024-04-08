import type { Signer } from 'ethers';
import {
    SubscriptionManager,
    SecretsManager,
    createGist,
} from "@chainlink/functions-toolkit";
import { networkConfig } from "../helper-hardhat-config"


type Secrets = {
    token_key: string,
    ipfsAuth: string
}

export const encryptSecrets = async (chainId: number, signer: any, secrets: Secrets): Promise<string> => {
    const functionRouterAddress = networkConfig[chainId].functionsRouter!
    const donId = networkConfig[chainId].functionsDonId!

    console.log(functionRouterAddress, donId)

    const githubApiToken = process.env.GITHUB_API_TOKEN;
    if (!githubApiToken)
        throw new Error(
            "githubApiToken not provided - check your environment variables"
        );

    const secretsManager = new SecretsManager({
        signer: signer,
        functionsRouterAddress: functionRouterAddress,
        donId: donId,
    });

    await secretsManager.initialize();

    const encryptedSecretsObj = await secretsManager.encryptSecrets(secrets);

    console.log(`Creating gist...`);

    // Create a new GitHub Gist to store the encrypted secrets
    const gistURL = await createGist(
        githubApiToken,
        JSON.stringify(encryptedSecretsObj)
    );
    console.log(`\n✅Gist created ${gistURL} . Encrypting the URLs..`);
    const encryptedSecretsUrls = await secretsManager.encryptSecretsUrls([
        gistURL,
    ]);
    return encryptedSecretsUrls
}

export const addConsumer = async (chainId: number, signer: any, consumerAddress: string) => {
    const functionRouterAddress = networkConfig[chainId].functionsRouter!
    const linkTokenAddress = networkConfig[chainId].linkToken!
    const subscriptionId = networkConfig[chainId].functionsSubscriptionId!
    const subscriptionManager = new SubscriptionManager({
        signer: signer,
        linkTokenAddress: linkTokenAddress,
        functionsRouterAddress: functionRouterAddress,
    });
    await subscriptionManager.initialize();

    console.log("----------------------------------------------------");
    console.log("Adding consumer to subscription manager...")
    await subscriptionManager.addConsumer({
        subscriptionId,
        consumerAddress: consumerAddress,
    })
    console.log("✅Consumer added to subscription manager");
}
