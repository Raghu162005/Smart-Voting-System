# 🗳️ Smart Voting System

A full-stack electronic voting platform that combines **biometric authentication**, **anti-spoofing liveness detection**, **email/Firebase OTP**, and a **dual blockchain audit trail** to make remote voting verifiable and tamper-evident.

Built with a Flask REST API, a Next.js 16 frontend, and a Solidity smart contract deployed on the Ethereum Sepolia testnet.

![Next.js](https://img.shields.io/badge/Next.js-16.2.4-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2.4-61dafb?logo=react&logoColor=black)
![Flask](https://img.shields.io/badge/Flask-Python-000000?logo=flask)
![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363636?logo=solidity)
![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-3c3c3d?logo=ethereum)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite)

> **Academic / demo project.** It is designed to demonstrate a complete, end-to-end verifiable voting workflow — not to run a real public election. See [Security & Limitations](#security--limitations) before deploying anywhere.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Smart Contract Deployment](#smart-contract-deployment)
- [API Reference](#api-reference)
- [How a Vote Is Cast](#how-a-vote-is-cast)
- [Database Schema](#database-schema)
- [Security & Limitations](#security--limitations)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [Publishing to GitHub](#publishing-to-github)
- [License](#license)

---

## Features

### Voter verification
- **Face enrollment** during registration using DeepFace (`Facenet` embeddings + `RetinaFace` detector).
- **Duplicate-face prevention** — a face already registered under another name is rejected.
- **Liveness / anti-spoofing challenges** (blink, turn head, smile, nod) so a photo or video replay cannot be used.
- **Email OTP** verification with configurable expiry, plus optional **Firebase phone verification**.
- **Staged, short-lived server tokens** — liveness → face → OTP — so verification steps cannot be skipped by calling the API directly.

### Elections
- Create, edit, close, and delete elections from an admin dashboard.
- Add candidates with party name, symbol image, and constituency.
- **Constituency-aware voting** — voters only see candidates contesting in their registered constituency.
- **NOTA** ("None of the Above") is added automatically to every election.
- **One vote per voter per election**, enforced in the database, in the local chain, and in the smart contract.

### Auditing & results
- **Local SHA-256 blockchain** in SQLite for tamper-evident vote records, with an integrity-verification endpoint.
- **Ethereum anchoring** on Sepolia — each vote is recorded on-chain via `Voting.sol`, with the transaction hash and Etherscan link returned to the voter.
- Live **results dashboard** with per-constituency breakdowns, winner/tie detection, NOTA counts, and chain verification.
- **Emailed result notifications** to voters, sent automatically when an election ends (or manually by an admin).

### Administration
- JWT-based admin login with server-side token revocation on logout.
- Dashboard stats and tabs for elections, candidates, voters, vote summaries, and results.
- Voter lookup, detail editing, and removal; candidate symbol uploads.
- Manual result-email dispatch and on-demand chain verification.

---

## Architecture

```
                    ┌────────────────────────────────────┐
                    │        Next.js 16 Frontend         │
                    │  register · vote · results · admin │
                    └─────────────────┬──────────────────┘
                                      │ REST / JSON (CORS)
                    ┌─────────────────▼──────────────────┐
                    │        Flask API  (:5000)          │
                    │   JWT auth · staged verify tokens  │
                    └───┬──────────────┬─────────────┬───┘
                        │              │             │
             ┌──────────▼───┐  ┌───────▼───────┐  ┌──▼─────────────────┐
             │   SQLite     │  │ DeepFace +    │  │ Ethereum Sepolia   │
             │  voting.db   │  │ OpenCV        │  │ Voting.sol         │
             │  voters      │  │ liveness      │  │ (web3.py, owner-   │
             │  elections   │  │ Facenet emb.  │  │  only castVote)    │
             │  candidates  │  │ RetinaFace    │  └────────────────────┘
             │  votes       │  └───────────────┘
             │  blocks ⛓    │      ┌─────────────────────┐
             └──────────────┘      │ SMTP (OTP + results)│
                                   └─────────────────────┘
```

### Verification chain

```
GET  /liveness-challenge ──► user performs action
POST /liveness-check     ──► liveness_token (10 min)
POST /verify-face        ──► face_token bound to voter name (10 min)
POST /send-otp           ──► 6-digit OTP e-mailed (10 min TTL)
POST /verify-otp         ──► voter marked OTP-verified
POST /vote               ──► SQLite vote + local block + Ethereum tx
```

Every downstream stage requires the token issued by the previous one, so the flow cannot be short-circuited.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.2.4 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Frontend libs | Firebase Web SDK (phone auth), Lucide React icons |
| Backend | Python 3.10, Flask, Flask-CORS |
| Biometrics | DeepFace 0.0.99, TensorFlow/Keras, OpenCV, RetinaFace, Facenet |
| Auth | PyJWT (admin), e-mail OTP, Firebase Admin SDK (optional phone) |
| Database | SQLite 3 |
| Blockchain | Local SHA-256 ledger + Solidity 0.8.19 + Web3.py on Ethereum Sepolia |
| Email | SMTP (Gmail App Password compatible), HTML templates |

---

## Project Structure

```
smart_voting_system_structure/
├── backend/
│   ├── api/
│   │   ├── app.py                  # Flask app: all REST endpoints, DB schema, auth
│   │   ├── email_templates.py      # HTML/text templates for OTP and result emails
│   │   ├── .env.example            # Backend environment template
│   │   ├── voting.db               # SQLite database (auto-created, generated)
│   │   ├── faces/                  # Enrolled face images + DeepFace embeddings
│   │   ├── party_symbols/          # Party/candidate symbol images
│   │   ├── uploads/                # Uploaded assets
│   │   └── debug_captures/         # Optional debug snapshots of verification frames
│   └── services/
│       ├── blockchain.py           # Local SHA-256 chain stored in the blocks table
│       ├── ethereum.py             # Web3.py Sepolia client (castVote)
│       └── liveness.py             # Liveness challenges + anti-spoofing checks
├── blockchain/
│   ├── contracts/Voting.sol        # Solidity voting contract
│   ├── scripts/deploy.py           # Sepolia deployment script
│   └── requirements.txt            # web3 dependency
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Landing page
│   │   ├── register/page.tsx       # Face registration + liveness
│   │   ├── vote/page.tsx           # Liveness → face → OTP → ballot
│   │   ├── results/page.tsx        # Live public results
│   │   └── admin/                  # Admin login + dashboard
│   ├── lib/firebase.ts             # Firebase client initialization
│   ├── package.json
│   └── .env.local                  # Frontend Firebase config (not committed)
├── check_system_status.py          # Environment/health preflight script
├── .gitignore
└── README.md
```

> Paths such as `voting.db`, `faces/`, and `party_symbols/` are **relative**, so always start the backend from `backend/api/`.

---

## Getting Started

### Prerequisites

| Requirement | Version / Notes |
|---|---|
| Python | 3.10.x (64-bit) recommended |
| Node.js | 20.9+ (Next.js 16 requirement; 20/22 LTS recommended) |
| npm | Bundled with Node.js |
| Webcam | Required for registration and voting |
| Browser | Chrome/Edge with camera permission |
| Gmail account | For SMTP OTP e-mail (App Password) |
| Infura/Alchemy account | Optional — only for Ethereum anchoring |
| Sepolia test ETH | Optional — for on-chain vote transactions |

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/smart-voting-system.git
cd smart-voting-system
```

### 2. Set up the backend

```bash
cd backend/api
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install --upgrade pip
pip install Flask flask-cors opencv-python numpy deepface PyJWT python-dotenv web3 firebase-admin
```

Create the environment file:

```bash
# Windows
copy .env.example .env
# macOS / Linux
cp .env.example .env
```

Fill in `JWT_SECRET_KEY` and the SMTP values (see [Configuration](#configuration)). Then start the API:

```bash
python app.py
```

The server listens on **http://127.0.0.1:5000**.

> **First run is slow:** DeepFace downloads the Facenet and RetinaFace model weights (hundreds of MB) on first use. Subsequent starts are much faster.

### 3. Set up the frontend

In a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Start the dev server:

```bash
npm run dev
```

The app is available at **http://localhost:3000**.

### 4. Open the app

| Page | URL |
|---|---|
| Landing | http://localhost:3000 |
| Voter registration | http://localhost:3000/register |
| Cast a vote | http://localhost:3000/vote |
| Live results | http://localhost:3000/results |
| Admin login | http://localhost:3000/admin/login |
| Admin dashboard | http://localhost:3000/admin |

**Admin access:** The default admin credentials are hard-coded in the `admin_login()` function in `backend/api/app.py`. Change them before sharing, recording a demo, or deploying.

### 5. Create your first election

1. Log in at `/admin/login`.
2. Open **Create** and set the election name, start time, and end time.
3. Add candidates (name, party, constituency, symbol).
4. Register at least one voter at `/register` (liveness + webcam capture).
5. While the election window is open, vote at `/vote`.
6. Watch counts at `/results`, or verify the audit chain from the admin **Votes** tab.

---

## Configuration

### Backend — `backend/api/.env`

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET_KEY` | Yes | Secret used to sign admin JWTs. Use a long random string. |
| `SMTP_HOST` | Yes (for email OTP) | SMTP server (default `smtp.gmail.com`). |
| `SMTP_PORT` | No | SMTP port (default `587`, STARTTLS). |
| `SMTP_SENDER_EMAIL` | Yes | Authenticated mailbox; must match the SMTP login. |
| `SMTP_SENDER_NAME` | No | Display name in outgoing mail. |
| `SMTP_APP_PASSWORD` | Yes | Gmail **App Password** (not your normal account password). |
| `SMTP_TIMEOUT` | No | SMTP socket timeout in seconds (default `20`). |
| `OTP_TTL_SECONDS` | No | OTP lifetime (default `600` = 10 minutes). |
| `APP_BASE_URL` | No | Public frontend URL used in email links. |
| `ETH_RPC_URL` | Optional | Sepolia RPC endpoint (e.g. Infura/Alchemy). Enables Ethereum anchoring. |
| `ETH_PRIVATE_KEY` | Optional | Private key of the wallet that owns the deployed contract. |
| `ETH_CONTRACT_ADDRESS` | Optional | Deployed `Voting.sol` address. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Optional | Path to the Firebase service-account JSON (default `firebase-service-account.json`). |

> `ETH_*` variables are not listed in `.env.example`; add them manually. If they are absent or invalid, the backend prints `ETHEREUM DISABLED` and continues with the local chain only.

### Frontend — `frontend/.env.local`

Only Firebase Web SDK keys prefixed with `NEXT_PUBLIC_` are needed. Phone verification is optional; email OTP works independently.

> The API base URL is currently hard-coded as `http://localhost:5000` in the frontend pages. Change it in `app/vote/page.tsx`, `app/register/page.tsx`, `app/results/page.tsx`, `app/admin/page.tsx`, and `app/admin/login/page.tsx` when hosting the backend elsewhere.

---

## Smart Contract Deployment

`blockchain/contracts/Voting.sol` stores vote counts, voter hashes, and vote records on-chain. Only the contract owner — the backend wallet — can call `castVote()`, after identity verification happens off-chain.

```bash
cd blockchain
pip install -r requirements.txt

# PowerShell
$env:ETH_RPC_URL="https://sepolia.infura.io/v3/<your-key>"
$env:ETH_PRIVATE_KEY="0x<your-private-key>"

# macOS / Linux
export ETH_RPC_URL="https://sepolia.infura.io/v3/<your-key>"
export ETH_PRIVATE_KEY="0x<your-private-key>"

python scripts/deploy.py
```

Copy the printed contract address into `backend/api/.env` as `ETH_CONTRACT_ADDRESS`, then restart the backend.

**Contract details**

| Item | Value |
|---|---|
| Solidity version | `^0.8.19` |
| Network | Ethereum Sepolia (chain ID `11155111`, hard-coded in `ethereum.py`) |
| Write access | Owner only (`castVote`) |
| Reads | `owner`, `getVoteCount`, `getTotalVotes`, `getVotes` (paginated) |
| Double-vote guard | `hasVoted[electionId][keccak256(voterName, electionId)]` |

The deployer wallet must be the same wallet configured in `ETH_PRIVATE_KEY`. If not, transfer ownership with `transferOwnership()`.

---

## API Reference

Base URL: `http://localhost:5000`

### Public endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/liveness-challenge` | Get a random liveness challenge. |
| `POST` | `/liveness-check` | Submit challenge frames → returns `liveness_token`. |
| `POST` | `/verify-face` | Match a captured face (requires `liveness_token`) → returns `face_token`. |
| `POST` | `/send-otp` | Send an email OTP (requires `face_token` matching the voter). |
| `POST` | `/verify-otp` | Verify the OTP (requires `face_token`). |
| `POST` | `/firebase-verify` | Verify a Firebase phone ID token (requires `face_token`). |
| `POST` | `/register` | Register a voter (name, contact, region, face image, `liveness_token`). |
| `GET` | `/elections-public` | List visible elections. |
| `GET` | `/active-elections` | List currently active elections. |
| `GET` | `/active-election` | Return the single active election, if any. |
| `GET` | `/candidates/<election_id>` | List candidates; optional `?constituency=`. |
| `POST` | `/vote` | Cast a vote (requires a completed OTP step). |
| `GET` | `/results/<election_id>` | Public result summary and winner/tie data. |
| `GET` | `/chain/<election_id>` | Return the local blockchain for an election. |
| `GET` | `/verify-chain/<election_id>` | Verify local chain integrity. |
| `GET` | `/ethereum-status` | Report Ethereum connection, wallet, and contract status. |
| `GET` | `/party_symbols/<filename>` | Serve a party/candidate symbol image. |
| `GET` | `/face-image/<name>` | Serve an enrolled voter photo. |

### Admin endpoints

Send the JWT as `Authorization: Bearer <token>` (a raw token is also accepted).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/admin/login` | Obtain an admin JWT. |
| `GET` | `/admin/verify` | Validate the current session. |
| `POST` | `/admin/logout` | Revoke the current token server-side. |
| `GET` | `/voters` | List registered voters. |
| `PUT` | `/voter/<name>` | Update voter details. |
| `DELETE` | `/voter/<name>` | Remove a voter (and their face file). |
| `POST` | `/create-election` | Create an election (auto-adds NOTA). |
| `GET` | `/elections` | List all elections with metadata. |
| `PUT` | `/edit-election/<id>` | Edit an election. |
| `DELETE` | `/delete-election/<id>` | Delete an election and its data. |
| `POST` | `/add-candidate` | Add a candidate with party symbol. |
| `DELETE` | `/delete-candidate/<id>` | Remove a candidate. |
| `GET` | `/election-votes/<id>` | Full vote list plus per-candidate summary. |
| `POST` | `/send-election-results/<id>` | Manually email results to voters. |

---

## How a Vote Is Cast

1. **Open the ballot** — the voter picks the currently active election.
2. **Liveness check** — the browser captures frames while the voter performs a random action (blink, turn, nod, smile). The backend scores the frames and returns a short-lived token.
3. **Face verification** — the captured frame is embedded with Facenet and compared by cosine distance against all enrolled voters. A match must be below the acceptance threshold **and** clearly ahead of the runner-up to avoid misidentification.
4. **OTP** — a 6-digit code is e-mailed to the registered address and must be entered before it expires.
5. **Ballot** — candidates are filtered to the voter's constituency, with NOTA always present.
6. **Recording** — the vote is written to SQLite, appended to the local SHA-256 chain, and submitted to the Sepolia contract. The response includes the local block hash, transaction hash, and an Etherscan link.
7. **Results** — counts appear live on `/results`; result e-mails are sent automatically after the election ends.

---

## Database Schema

SQLite (`backend/api/voting.db`) is created and migrated automatically at startup.

| Table | Purpose |
|---|---|
| `voters` | Voter name (PK), email, phone, state, district, constituency. |
| `elections` | Election name, start/end timestamps, result-email flags and expiry. |
| `candidates` | Candidate name, party, symbol path, election ID, constituency, NOTA flag. |
| `votes` | Voter name, candidate ID, election ID, timestamp, local block hash, Ethereum tx hash. |
| `blocks` | Per-election SHA-256 chain: index, timestamp, vote data, previous hash, hash, nonce. |

---

## Security & Limitations

**Implemented safeguards**

- Staged, expiring tokens binding liveness → face → OTP → vote.
- Cosine-distance face matching with an ambiguity margin to reduce false matches.
- Duplicate-face detection at registration.
- OTPs stored server-side with expiry and compared in constant time; never logged.
- Server-side double-vote and constituency checks, independent of the UI.
- Parameterized SQL queries throughout.
- JWT admin sessions with server-side revocation on logout.
- Owner-only smart contract writes; duplicate-vote guard on-chain.
- Local chain hashes every vote; verification endpoint detects tampering.

**Known limitations (demo-grade)**

- Admin credentials are hard-coded in `app.py` — replace them with a proper user store before any real use.
- CORS is fully open and the API runs over HTTP in development.
- SQLite is not suited to high-concurrency or multi-instance deployments.
- Face images, embeddings, and voter records are stored unencrypted on disk.
- Local chain security depends on the database; Ethereum anchoring is the stronger guarantee.
- Browser camera access requires **HTTPS** outside `localhost`.
- An election is "active" based on server time; there is no distributed clock or time-lock.
- Result e-mails depend on external SMTP deliverability (spam filters can interfere).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `voting.db` created in the wrong place / routes 500 | Start Flask from `backend/api` — data paths are relative. |
| Face models fail to download on first run | Check internet access; DeepFace downloads weights to `%USERPROFILE%\.deepface`. |
| Camera preview is blank | Grant camera permission and use `localhost` or HTTPS. |
| OTP not received | Verify `SMTP_SENDER_EMAIL` matches the authenticated mailbox and use a Gmail **App Password**; check spam. |
| `ETHEREUM DISABLED` in logs | Set all three `ETH_*` variables and restart; the app still works without Ethereum. |
| On-chain vote fails | Ensure the backend wallet owns the contract, has Sepolia ETH for gas, and the RPC URL is valid. |
| Admin login says invalid credentials | The demo credentials live in `admin_login()` in `app.py`. |
| Windows path/backslash issues | Run commands from the documented directories; prefer forward slashes in config values. |

A quick environment preflight is available:

```bash
python check_system_status.py
```

---

## Documentation

- [`check_system_status.py`](check_system_status.py) — checks files, dependencies, configuration, and database readiness.
- [`frontend/README.md`](frontend/README.md) — default Next.js starter notes.

> The detailed implementation report and feature-status report are kept locally and intentionally excluded from this repository.

---

## Publishing to GitHub

The repository ships with a root `.gitignore` that keeps local secrets, databases, biometric captures, generated build output, and personal document images out of version control. The following are intentionally **not** tracked:

- `backend/api/.env`, `backend/api/firebase-service-account.json`, `frontend/.env.local`
- `backend/api/voting.db`, `backend/api/faces/`, `backend/api/debug_captures/`
- `backend/api/venv/`, `frontend/node_modules/`, `frontend/.next/`
- `REPORT_DOCUMENTATION.md`, `SYSTEM_STATUS_REPORT.md`
- Personal/scanned images in `backend/api/party_symbols/`

If you fork this project, create your own configuration from `.env.example`, never commit real credentials, and rotate any secret that has ever been exposed.

---

## License

This project was developed for academic and educational purposes. No open-source license has been declared yet — add a `LICENSE` file (e.g. MIT) if you intend to distribute or reuse the code.

---

<p align="center">Built with Flask, Next.js, DeepFace, and Ethereum Sepolia.</p>
