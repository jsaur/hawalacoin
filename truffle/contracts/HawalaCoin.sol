// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * Defines 4 roles Donor, Client, CSO, and Agent for sending around value.
 * The Donor mints tokens by sending a wire transfer to the Client who holds the underlying money.
 * The Donor can then give those tokens to the CSO to pay for things in the conflict zone.
 * The CSOs can cash out their tokens with Agents in the conflict zone.
 * Agents cash out thier tokens with the Client outside the conflict zone, at which point the Client can burn the tokens.
 * TODO for all the functions that require some external flow (eg wire transfer, cash exchange) we should add some type of confirmation
 * TODO investigate OpenZepplin AccessControl - at first glance it didn't match our needs but should investigate again
 */
contract HawalaCoin is ERC1155, ERC1155Receiver, ERC1155Holder, Ownable  {
    using Counters for Counters.Counter;
    
    Counters.Counter _tokenCounter;
    
    mapping(address => Role) public users;
    enum Role {NONE, DONOR, CLIENT, CSO, AGENT}

    Counters.Counter _missionCounter;
    struct Mission {
        address csoAddr;
        address agentAddr;
        uint256 tokenId;
        uint256 amount;
        bool completed;
    }
    mapping(uint256 => Mission) public missions;
    
    // TODO add events
    
    /**
     * Called by the contract owner
     */
    constructor() ERC1155("") {}
    
    /**
     * Bubble supportsInterface down the class hierarchy
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, ERC1155Receiver) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    /**
     * TODO add rules:
     * 1) DONOR can only be added by contract owner
     * 2) CLIENT can only be added by DONOR
     * 3) CSO can only be added by DONOR
     * 4) AGENT can only be added by CLIENT
     * TODO add check if user already exists - error or update?
     */
    function addUser(address addr, Role role) public {
        users[addr] = role;
    }
    
    /**
     * Mints an amount of new tokens for the Donor which are redeamable at the Client
     * TODO add rule: only Donor can call
     * TODO add currency field, right now we assume amount in USD in pennies
     * TODO add some type of verification/confirmation to ensure minted tokens truly reflect new bank balance
     */
    function mint(address donorAddr, address clientAddr, uint256 amount) public {
        require(donorAddr == msg.sender, "Sender must match the donorAddr");
        uint256 tokenId = _tokenCounter.current();
        _tokenCounter.increment();
        _mint(donorAddr, tokenId, amount, abi.encodePacked(clientAddr));
    }
    
    /**
     * TODO add rule: only Client can call
     */
    function burn(address clientAddr, uint256 tokenId, uint256 amount) public {
        require(clientAddr == msg.sender, "Sender must match the clientAddr");
        _burn(msg.sender, tokenId, amount);
    }
    
    /**
     * TODO add rule: only CSO can call
     * Creates mission for a specific agent and transfers tokens to contract for escrow
     */
    function createMission(address csoAddr, address agentAddr, uint256 tokenId, uint256 amount) public {
        require(csoAddr == msg.sender, "Sender must match the csoAddr");
        uint256 missionId = _missionCounter.current();
        missions[missionId] = Mission({
           csoAddr: csoAddr,
           agentAddr: agentAddr,
           tokenId: tokenId,
           amount: amount,
           completed: false
        });
        this.safeTransferFrom(csoAddr, address(this), tokenId, amount, "");
    }
    
    /**
     * TODO add rule: only Agent can call
     * TODO add functionality to allow for partial mission completions which would return some amount back to CSO
     */
    function completeMission(address agentAddr, uint256 missionId) public {
        require(agentAddr == msg.sender, "Sender must match the agentAddr");
        uint256 tokenId = missions[missionId].tokenId;
        uint256 amount = missions[missionId].amount;
        missions[missionId].completed = true;
        this.safeTransferFrom(address(this), agentAddr, tokenId, amount, "");
    }

    /**
     * Convinience function to get the current token id so we can loop through all previous tokens
     */
    function currentTokenId() public view returns (uint256) {
        return _tokenCounter.current();
    }

    /**
     * Convinience function to get the current missions id so we can loop through all previous missions
     */
    function currentMissionId() public view returns (uint256) {
        return _missionCounter.current();
    }
}
