// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/libraries/FunctionsRequest.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DataListing is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;

    string[] public s_dataCIDs;

    mapping(bytes32 requestId => address provider) private s_dataPointProviders;

    string public s_provideScript;
    string public s_tokenKey;
    string public s_dataKey;
    bytes public s_encryptedSecretsUrls;
    string public s_dataSource;
    address public immutable i_tokenAddress;
    address public immutable i_purchaser;
    IERC20 private s_token;
    uint256 public s_tokenBalance;
    uint256 public s_dataPointQuantity;
    uint256 public immutable i_dataPointPrice;

    error UnexpectedRequestID(bytes32 requestId);

    event Response(bytes32 indexed requestId, bytes response, bytes err);
    event Reward(address provider, uint256 amount);

    /**
     * @notice Initialize the contract with a specified address for the LINK token
     * @param router The address of the LINK token contract
     * @param provideScript The script which makes an API request and posts the response to IPFS
     * @param tokenKey The public key to encrypt user secret keys
     * @param dataKey The public key to encrypt users data
     * @param encryptedSecretsUrls Encrypted URLs where to fetch contract secrets
     * @param dataSource The source of the provided data
     **/
    constructor(
        address router,
        string memory provideScript,
        string memory tokenKey,
        string memory dataKey,
        bytes memory encryptedSecretsUrls,
        string memory dataSource,
        address tokenAddress,
        uint256 initialBalance,
        uint256 dataPointQuantity
    ) FunctionsClient(router) ConfirmedOwner(tx.origin) {
        i_purchaser = tx.origin;
        s_provideScript = provideScript;
        s_tokenKey = tokenKey;
        s_dataKey = dataKey;
        s_encryptedSecretsUrls = encryptedSecretsUrls;
        s_dataSource = dataSource;
        i_tokenAddress = tokenAddress;
        s_token = IERC20(tokenAddress);
        s_tokenBalance = initialBalance;
        s_dataPointQuantity = dataPointQuantity;
        i_dataPointPrice = s_tokenBalance / s_dataPointQuantity;
    }

    /**
     * @notice Send a request to provide data
     * @param donHostedSecretsSlotID Don hosted secrets slotId
     * @param donHostedSecretsVersion Don hosted secrets version
     * @param args List of arguments accessible from within the source code
     * @param bytesArgs Array of bytes arguments, represented as hex strings
     * @param subscriptionId Billing ID
     */
    function provideData(
        uint8 donHostedSecretsSlotID,
        uint64 donHostedSecretsVersion,
        string[] memory args,
        bytes[] memory bytesArgs,
        uint64 subscriptionId,
        uint32 gasLimit,
        bytes32 donID
    ) external {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(s_provideScript);
        if (s_encryptedSecretsUrls.length > 0) req.addSecretsReference(s_encryptedSecretsUrls);
        else if (donHostedSecretsVersion > 0) {
            req.addDONHostedSecrets(donHostedSecretsSlotID, donHostedSecretsVersion);
        }
        if (args.length > 0) req.setArgs(args);
        if (bytesArgs.length > 0) req.setBytesArgs(bytesArgs);
        s_lastRequestId = _sendRequest(req.encodeCBOR(), subscriptionId, gasLimit, donID);
        s_dataPointProviders[s_lastRequestId] = tx.origin;
    }

    /**
     * @notice Send a pre-encoded CBOR request
     * @param request CBOR-encoded request data
     * @param subscriptionId Billing ID
     * @param gasLimit The maximum amount of gas the request can consume
     * @param donID ID of the job to be invoked
     * @return requestId The ID of the sent request
     */
    function sendRequestCBOR(
        bytes memory request,
        uint64 subscriptionId,
        uint32 gasLimit,
        bytes32 donID
    ) external onlyOwner returns (bytes32 requestId) {
        s_lastRequestId = _sendRequest(request, subscriptionId, gasLimit, donID);
        return s_lastRequestId;
    }

    /**
     * @notice Store latest result/error
     * @param requestId The request ID, returned by sendRequest()
     * @param response Aggregated response from the user code
     * @param err Aggregated error from the user code or from the execution pipeline
     * Either response or error parameter will be set, but never both
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (s_lastRequestId != requestId) {
            revert UnexpectedRequestID(requestId);
        }
        s_lastResponse = response;
        s_lastError = err;

        address provider = s_dataPointProviders[requestId];
        string memory responseString = string(response);

        if (err.length == 0) {
            s_dataCIDs.push(responseString);
            s_dataPointQuantity -= 1;
            s_tokenBalance -= i_dataPointPrice;
            require(s_token.transfer(provider, i_dataPointPrice), "Token transfer failed");
            emit Reward(provider, i_dataPointPrice);
        }

        emit Response(requestId, s_lastResponse, s_lastError);
    }

    function getTokenKey() external view returns (string memory) {
        return s_tokenKey;
    }

    function getDataKey() external view returns (string memory) {
        return s_dataKey;
    }

    function getEncryptedSecretsUrls() external view returns (bytes memory) {
        return s_encryptedSecretsUrls;
    }

    function getDataCIDs() external view returns (string[] memory) {
        return s_dataCIDs;
    }

    function getDataSource() external view returns (string memory) {
        return s_dataSource;
    }

    function getPurchaser() external view returns (address) {
        return i_purchaser;
    }

    function getDataPointPrice() external view returns (uint256) {
        return i_dataPointPrice;
    }

    function getTokenBalance() external view returns (uint256) {
        return s_tokenBalance;
    }
}
