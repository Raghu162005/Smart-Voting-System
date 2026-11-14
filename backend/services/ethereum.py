from web3 import Web3
import os
from dotenv import load_dotenv

load_dotenv()

RPC_URL = os.getenv("ETH_RPC_URL")
PRIVATE_KEY = os.getenv("ETH_PRIVATE_KEY")
CONTRACT_ADDRESS = os.getenv("ETH_CONTRACT_ADDRESS")

print("RPC_URL =", RPC_URL)
print("PRIVATE_KEY =", PRIVATE_KEY)
print("CONTRACT_ADDRESS =", CONTRACT_ADDRESS)

# Contract ABI (minimal subset needed for voting)
CONTRACT_ABI = [
    {
        "inputs": [
            {"name": "voterName", "type": "string"},
            {"name": "electionId", "type": "uint256"},
            {"name": "candidateId", "type": "uint256"}
        ],
        "name": "castVote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "electionId", "type": "uint256"},
            {"name": "candidateId", "type": "uint256"}
        ],
        "name": "getVoteCount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalVotes",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

w3 = Web3(Web3.HTTPProvider(RPC_URL))


class EthereumClient:

    def __init__(self):
        self.is_ready = False
        self.account = None
        self.contract = None

        try:
            if not RPC_URL:
                raise Exception("ETH_RPC_URL not found")

            if not PRIVATE_KEY:
                raise Exception("ETH_PRIVATE_KEY not found")

            if not CONTRACT_ADDRESS:
                raise Exception("ETH_CONTRACT_ADDRESS not found")

            self.account = w3.eth.account.from_key(PRIVATE_KEY)

            self.contract = w3.eth.contract(
                address=Web3.to_checksum_address(CONTRACT_ADDRESS),
                abi=CONTRACT_ABI
            )

            self.is_ready = True

            print("\n===== ETHEREUM CONNECTED =====")
            print("Connected:", w3.is_connected())
            print("Wallet:", self.account.address)
            print("Contract:", CONTRACT_ADDRESS)
            print("==============================\n")

        except Exception as e:
            print("\n===== ETHEREUM DISABLED =====")
            print("Reason:", e)
            print("=============================\n")

    def cast_vote(self, voter_name, election_id, candidate_id):

        if not self.is_ready:
            return None

        try:

            nonce = w3.eth.get_transaction_count(
                self.account.address,
                "pending"
            )

            tx = self.contract.functions.castVote(
                voter_name,
                int(election_id),
                int(candidate_id)
            ).build_transaction({
                "from": self.account.address,
                "nonce": nonce,
                "chainId": 11155111,
                "gas": 300000,
                "maxFeePerGas": w3.to_wei(2, "gwei"),
                "maxPriorityFeePerGas": w3.to_wei(1, "gwei"),
            })

            signed_tx = self.account.sign_transaction(tx)

            tx_hash = w3.eth.send_raw_transaction(
                signed_tx.raw_transaction
            )

            receipt = w3.eth.wait_for_transaction_receipt(
                tx_hash,
                timeout=120
            )

            print("Vote stored on Ethereum")
            print("Tx Hash:", tx_hash.hex())
            print("Block:", receipt.blockNumber)

            return {
                "success": True,
                "tx_hash": tx_hash.hex(),
                "block": receipt.blockNumber,
                "contract_address": CONTRACT_ADDRESS
            }

        except Exception as e:
            print("Ethereum vote error:", e)

            return {
                "success": False,
                "error": str(e)
            }

    def get_contract_address(self):
        return CONTRACT_ADDRESS

    def get_status(self):
        return {
            "enabled": self.is_ready,
            "connected": w3.is_connected(),
            "wallet": self.account.address if self.account else None,
            "contract_address": CONTRACT_ADDRESS
        }

    def get_balance(self):

        if not self.account:
            return 0

        try:
            balance = w3.eth.get_balance(
                self.account.address
            )

            return float(
                w3.from_wei(balance, "ether")
            )

        except:
            return 0


ethereum = EthereumClient()