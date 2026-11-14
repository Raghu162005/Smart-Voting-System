import os

from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

RPC_URL = os.getenv("ETH_RPC_URL")
CONTRACT_ADDRESS = os.getenv("ETH_CONTRACT_ADDRESS")

if not RPC_URL:
    raise SystemExit("ETH_RPC_URL is not set. Configure backend/api/.env first.")

w3 = Web3(Web3.HTTPProvider(RPC_URL))

print("Connected:", w3.is_connected())
print("Chain ID:", w3.eth.chain_id)
print("Latest Block:", w3.eth.block_number)
print("Contract:", CONTRACT_ADDRESS or "(ETH_CONTRACT_ADDRESS not set)")