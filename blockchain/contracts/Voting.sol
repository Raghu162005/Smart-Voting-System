// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Voting
 * @notice Immutable on-chain vote recording for the Smart Voting System.
 *         Only the contract owner (backend service) can record votes
 *         after verifying voter identity off-chain (face + OTP).
 */
contract Voting {
    address public owner;

    struct VoteRecord {
        string voterName;
        uint256 candidateId;
        uint256 electionId;
        uint256 timestamp;
    }

    // electionId => candidateId => vote count
    mapping(uint256 => mapping(uint256 => uint256)) public voteCounts;
    // electionId => keccak256(voterName) => has voted (prevents double-count)
    mapping(uint256 => mapping(bytes32 => bool)) public hasVoted;
    // All votes in order
    VoteRecord[] public votes;

    event VoteCast(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        string voterName,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Record a verified vote on-chain.
     * @param voterName     Unique voter identifier (name as registered)
     * @param electionId    Election ID
     * @param candidateId   Candidate ID the voter chose
     */
    function castVote(
        string calldata voterName,
        uint256 electionId,
        uint256 candidateId
    ) external onlyOwner {
        bytes32 voterHash = keccak256(abi.encodePacked(voterName, electionId));
        require(!hasVoted[electionId][voterHash], "Voter already voted in this election");

        voteCounts[electionId][candidateId]++;
        hasVoted[electionId][voterHash] = true;
        votes.push(VoteRecord(voterName, candidateId, electionId, block.timestamp));

        emit VoteCast(electionId, candidateId, voterName, block.timestamp);
    }

    /**
     * @notice Get vote count for a specific candidate in an election.
     */
    function getVoteCount(uint256 electionId, uint256 candidateId)
        external
        view
        returns (uint256)
    {
        return voteCounts[electionId][candidateId];
    }

    /**
     * @notice Get total number of votes recorded across all elections.
     */
    function getTotalVotes() external view returns (uint256) {
        return votes.length;
    }

    /**
     * @notice Get paginated vote records.
     */
    function getVotes(uint256 offset, uint256 limit)
        external
        view
        returns (VoteRecord[] memory)
    {
        uint256 total = votes.length;
        if (offset >= total) return new VoteRecord[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        VoteRecord[] memory result = new VoteRecord[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = votes[offset + i];
        }
        return result;
    }

    /**
     * @notice Transfer ownership (useful if backend wallet rotates).
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
