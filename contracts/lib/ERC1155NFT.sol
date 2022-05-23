// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./ProxyRegistry.sol";
import "./IERC2981.sol";

// This is largely replicating OpenZeppelin's ERC1155 - private access to owner
// mapping was needed for stashing.
contract ERC1155NFT is ERC165, IERC1155, IERC1155MetadataURI, IERC2981, Ownable {
    using Address for address;

    struct RoyaltyConfig {
        // The receiving address of royalty charges.
        address target;
        // The percentage points (in tenths of a %) to charge in royalties.
        uint8 points;
    }

    // Tokens currently minted.
    uint256 public mintedTokens = 0;

    // Mapping to owners (0 for stashed tokens).
    address[] internal _tokenOwners;

    // Wyvern proxy registry address.
    address private _proxyRegistryAddress;

    // Manual proxies.
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // Base URL of API.
    string private _baseUrl;

    // An address to send royalties for NFT trading to. Can only be set by owner.
    RoyaltyConfig private _royaltyConfig;

    constructor(string memory apiUrl, address proxyRegistryAddress) {
        _baseUrl = apiUrl;
        _proxyRegistryAddress = proxyRegistryAddress;
        _royaltyConfig = RoyaltyConfig({
            target: msg.sender,
            points: 70 // 7%
        });
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC165, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId ||
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC1155MetadataURI-uri}.
     *
     * This implementation returns a unique URI for each token, using a
     * "token/<id>" format, for a wider compatibility compared to "{id}"
     * replacement.
     */
    function uri(uint256 id) external view override returns (string memory) {
        require(id < mintedTokens, "Token does not exist");
        return string(abi.encodePacked(_baseUrl, "token/", Strings.toString(id)));
    }

    /**
     * @dev See {IERC1155-balanceOf}.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function balanceOf(address account, uint256 id) public view override returns (uint256) {
        require(account != address(0), "ERC1155: balance for address(0)");
        require(id < mintedTokens, "Token does not exist");
        return _tokenOwners[id] == account ? 1 : 0;
    }

    /**
     * @dev See {IERC1155-balanceOfBatch}.
     *
     * Requirements:
     *
     * - `accounts` and `ids` must have the same length.
     */
    function balanceOfBatch(address[] memory accounts, uint256[] memory ids)
        external
        view
        override
        returns (uint256[] memory)
    {
        require(accounts.length == ids.length, "ERC1155: accounts/ids mismatch");

        uint256[] memory batchBalances = new uint256[](accounts.length);

        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = balanceOf(accounts[i], ids[i]);
        }

        return batchBalances;
    }

    /**
     * @dev Gets the owner of a given token.
     */
    function getOwningAddress(uint256 id) external view returns (address) {
        return _tokenOwners[id];
    }

    /**
     * @dev Gets the owner(s) of a given batch of tokens.
     */
    function getOwningAddressBatch(uint256[] memory ids) external view returns (address[] memory) {
        address[] memory batchOwners = new address[](ids.length);

        for (uint256 i = 0; i < ids.length; ++i) {
            batchOwners[i] = _tokenOwners[ids[i]];
        }

        return batchOwners;
    }

    /**
     * @dev See {IERC1155-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved) external override {
        _setApprovalForAll(msg.sender, operator, approved);
    }

    /**
     * @dev See {IERC1155-isApprovedForAll}. This also whitelists the ProxyRegistry used by OpenSea.
     */
    function isApprovedForAll(address account, address operator)
        public
        view
        override
        returns (bool)
    {
        ProxyRegistry proxyRegistry = ProxyRegistry(_proxyRegistryAddress);
        if (address(proxyRegistry.proxies(account)) == operator) {
            return true;
        }

        return _operatorApprovals[account][operator];
    }

    /**
     * @dev See {IERC1155-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external override {
        require(id < mintedTokens, "Token does not exist");
        require(amount == 1, "Cannot transfer amount > 1");
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "ERC1155: caller is not approved"
        );
        _safeTransferFrom(from, to, id, amount, data);
    }

    /**
     * @dev See {IERC1155-safeBatchTransferFrom}.
     */
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external override {
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "ERC1155: caller is not approved"
        );
        _safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    /**
     * @dev See {IERC2981-royaltyInfo}.
     * @return receiver will always be the address of the deployer of the contract.
     * @return royaltyAmount will always be 7% of value.
     */
    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        receiver = _royaltyConfig.target;
        royaltyAmount = (value * _royaltyConfig.points) / 1000;
    }

    /**
     * @dev OpenSea spec metadata for the contract - always "<baseUrl>/contract".
     */
    function contractURI() external view returns (string memory) {
        return string(abi.encodePacked(_baseUrl, "contract"));
    }

    /**
     * @dev Transfers `amount` tokens of token type `id` from `from` to `to`.
     *
     * Emits a {TransferSingle} event.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `from` must have a balance of tokens of type `id` of at least `amount`.
     * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
     * acceptance magic value.
     */
    function _safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal {
        require(to != address(0), "ERC1155: transfer to address(0)");
        require(_tokenOwners[id] == from, "ERC1155: insufficient balance");

        _tokenOwners[id] = to;
        emit TransferSingle(msg.sender, from, to, id, amount);

        _doSafeTransferAcceptanceCheck(msg.sender, from, to, id, amount, data);
    }

    /**
     * @dev xref:ROOT:erc1155.adoc#batch-operations[Batched] version of {_safeTransferFrom}.
     *
     * Emits a {TransferBatch} event.
     *
     * Requirements:
     *
     * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155BatchReceived} and return the
     * acceptance magic value.
     */
    function _safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal {
        require(ids.length == amounts.length, "ERC1155: ids/amounts mismatch");
        require(to != address(0), "ERC1155: transfer to address(0)");

        uint256[] memory ones = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids[i];
            uint256 amount = amounts[i];
            require(id < mintedTokens, "Token does not exist");
            require(amount == 1, "Cannot transfer amount > 1");

            require(_tokenOwners[id] == from, "ERC1155: insufficient balance");
            _tokenOwners[id] = to;
            ones[i] = 0;
        }
        emit TransferBatch(msg.sender, from, to, ids, ones);

        _doSafeBatchTransferAcceptanceCheck(msg.sender, from, to, ids, amounts, data);
    }

    /**
     * @dev Approve `operator` to operate on all of `owner` tokens.
     *
     * Emits a {ApprovalForAll} event.
     */
    function _setApprovalForAll(
        address owner,
        address operator,
        bool approved
    ) private {
        require(owner != operator, "ERC1155: cannot approve self");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal {
        if (to.isContract()) {
            try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (
                bytes4 response
            ) {
                if (response != IERC1155Receiver.onERC1155Received.selector) {
                    revert("ERC1155: ERC1155Receiver reject");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: to not ERC1155Receiver");
            }
        }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal {
        if (to.isContract()) {
            try
                IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data)
            returns (bytes4 response) {
                if (response != IERC1155Receiver.onERC1155BatchReceived.selector) {
                    revert("ERC1155: ERC1155Receiver reject");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: to not ERC1155Receiver");
            }
        }
    }

    // Owner API.

    function withdraw(address payable wallet, uint256 amount) external onlyOwner {
        wallet.transfer(amount);
    }

    function setRoyaltyConfig(RoyaltyConfig memory newConfig) external onlyOwner {
        _royaltyConfig = newConfig;
    }

    function setBaseUrl(string memory newBaseUrl) public virtual onlyOwner {
        _baseUrl = newBaseUrl;
    }
}
