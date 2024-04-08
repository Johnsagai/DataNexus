// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {DataListing} from "./DataListing.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DataListingFactory {
    DataListing[] public s_dataListingContracts;
    string[] public s_dataListingSources;
    uint256[] public s_dataListingInitialBalances;
    uint256[] public s_dataListingDataPointQuantities;
    mapping(address => address[]) public contractOwners;

    event DataListingCreated(address indexed dataListing, string indexed dataSource);

    /**
     * @notice Create a new DataListing contract
     * @param router The address of the LINK token contract
     * @param provideScript The script which makes an API request and posts the response to IPFS
     * @param tokenKey The public key to encrypt user secret keys
     * @param dataKey The public key to encrypt users data
     * @param encryptedSecretsUrls Encrypted URLs where to fetch contract secrets
     * @param dataSource The source of the provided data
     **/
    function createDataListing(
        address router,
        string memory provideScript,
        string memory tokenKey,
        string memory dataKey,
        bytes memory encryptedSecretsUrls,
        string memory dataSource,
        address tokenAddress,
        uint256 initialBalance,
        uint256 dataPointQuantity
    ) external returns (address) {
        DataListing listing = new DataListing(
            router,
            provideScript,
            tokenKey,
            dataKey,
            encryptedSecretsUrls,
            dataSource,
            tokenAddress,
            initialBalance,
            dataPointQuantity
        );
        address purchaser = tx.origin;
        IERC20 token = IERC20(tokenAddress);
        uint256 purchaserTokenBalance = token.balanceOf(purchaser);
        uint256 purchaserTokenAllowance = token.allowance(purchaser, address(this));
        require(purchaserTokenBalance >= initialBalance, "Insufficient Token Balance");
        require(purchaserTokenAllowance >= initialBalance, "Insufficient Token Allowance");

        s_dataListingContracts.push(listing);
        s_dataListingSources.push(dataSource);
        s_dataListingInitialBalances.push(initialBalance);
        s_dataListingDataPointQuantities.push(dataPointQuantity);

        emit DataListingCreated(address(listing), dataSource);

        require(
            token.transferFrom(purchaser, address(listing), initialBalance),
            "Token transfer failed"
        );

        address listingAddress = address(listing);
        if (contractOwners[purchaser].length == 0) {
            contractOwners[purchaser] = [listingAddress];
        } else {
            contractOwners[purchaser].push(listingAddress);
        }

        return listingAddress;
    }

    /**
     * @notice Get the number of DataListing contracts
     **/
    function getNumberOfs_dataListingContracts() external view returns (uint256) {
        return s_dataListingContracts.length;
    }

    /**
     * @notice Get the list of DataListing contracts
     **/
    function getDataListings() external view returns (DataListing[] memory) {
        return s_dataListingContracts;
    }

    /**
     * @notice Get the list of DataListing sources
     **/
    function getDataListingSources() external view returns (string[] memory) {
        return s_dataListingSources;
    }

    /**
     * @notice Get a DataListing contract by index
     * @param index The index of the DataListing contract
     **/
    function getDataListing(uint256 index) external view returns (DataListing) {
        return s_dataListingContracts[index];
    }

    /**
     * @notice Get the last DataListing contract
     **/
    function getLastDataListing() external view returns (DataListing) {
        return s_dataListingContracts[s_dataListingContracts.length - 1];
    }

    /**
     * @notice Get an address's DataListing contracts
     **/
    function getOwnerListings(address owner) external view returns (address[] memory) {
        return contractOwners[owner];
    }

    /**
     * @notice Get an address's initial balance for a DataListing contract
     */
    function getDataListingInitialBalance() external view returns (uint256[] memory) {
        return s_dataListingInitialBalances;
    }

    /**
     * @notice Get an address's data point quantity for a DataListing contract
     */
    function getDataListingDataPointQuantity() external view returns (uint256[] memory) {
        return s_dataListingDataPointQuantities;
    }
}
