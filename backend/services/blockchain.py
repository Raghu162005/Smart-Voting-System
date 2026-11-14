import hashlib
from datetime import datetime


class Block:
    def __init__(self, index, timestamp, voter_name, candidate_id, election_id, previous_hash, hash=None, nonce=0):
        self.index = index
        self.timestamp = timestamp
        self.voter_name = voter_name
        self.candidate_id = candidate_id
        self.election_id = election_id
        self.previous_hash = previous_hash
        self.nonce = nonce
        self.hash = hash if hash else self.calculate_hash()

    def calculate_hash(self):
        data = f"{self.index}{self.timestamp}{self.voter_name}{self.candidate_id}{self.election_id}{self.previous_hash}{self.nonce}"
        return hashlib.sha256(data.encode()).hexdigest()

    def to_dict(self):
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "voter_name": self.voter_name,
            "candidate_id": self.candidate_id,
            "election_id": self.election_id,
            "previous_hash": self.previous_hash,
            "hash": self.hash,
            "nonce": self.nonce
        }


class Blockchain:

    def __init__(self, db_conn):
        self.conn = db_conn

    def create_genesis_block(self, election_id):
        block = Block(
            index=0,
            timestamp=datetime.utcnow().isoformat(),
            voter_name="GENESIS",
            candidate_id=0,
            election_id=election_id,
            previous_hash="0"
        )
        self._persist_block(block)
        return block

    def add_block(self, voter_name, candidate_id, election_id):
        last_block = self._get_last_block(election_id)

        if last_block is None:
            self.create_genesis_block(election_id)
            last_block = self._get_last_block(election_id)

        new_index = last_block.index + 1
        new_block = Block(
            index=new_index,
            timestamp=datetime.utcnow().isoformat(),
            voter_name=voter_name,
            candidate_id=candidate_id,
            election_id=election_id,
            previous_hash=last_block.hash
        )
        self._persist_block(new_block)
        return new_block

    def _persist_block(self, block):
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO blocks (block_index, timestamp, voter_name, candidate_id, election_id, previous_hash, hash, nonce)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (block.index, block.timestamp, block.voter_name, block.candidate_id,
              block.election_id, block.previous_hash, block.hash, block.nonce))
        self.conn.commit()

    def _get_last_block(self, election_id):
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT block_index, timestamp, voter_name, candidate_id, election_id, previous_hash, hash, nonce
            FROM blocks WHERE election_id = ? ORDER BY block_index DESC LIMIT 1
        """, (election_id,))
        row = cursor.fetchone()
        if row:
            return Block(*row)
        return None

    def get_chain(self, election_id):
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT block_index, timestamp, voter_name, candidate_id, election_id, previous_hash, hash, nonce
            FROM blocks WHERE election_id = ? ORDER BY block_index ASC
        """, (election_id,))
        rows = cursor.fetchall()
        return [Block(*row) for row in rows]

    def verify_chain(self, election_id):
        chain = self.get_chain(election_id)
        if not chain:
            return {"valid": True, "message": "No blocks in chain", "blocks": 0}

        for i in range(1, len(chain)):
            current = chain[i]
            previous = chain[i-1]

            if current.previous_hash != previous.hash:
                return {
                    "valid": False,
                    "message": f"Chain broken at block {current.index}: previous_hash does not match previous block's hash",
                    "blocks": len(chain),
                    "failed_block": current.index
                }

            recalculated = current.calculate_hash()
            if current.hash != recalculated:
                return {
                    "valid": False,
                    "message": f"Block {current.index} hash mismatch — vote data has been tampered with",
                    "blocks": len(chain),
                    "failed_block": current.index
                }

        return {"valid": True, "message": "Blockchain integrity verified — all hashes match", "blocks": len(chain)}
