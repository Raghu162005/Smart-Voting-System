#!/usr/bin/env python3
"""
Smart Voting System - Feature Status Checker
Checks all components and features to identify what's working and what needs setup
"""

import os
import sys
import sqlite3
import subprocess
import json
from pathlib import Path

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")

def print_check(name, status, details=""):
    symbol = f"{Colors.GREEN}[OK]{Colors.RESET}" if status else f"{Colors.RED}[FAIL]{Colors.RESET}"
    status_text = f"{Colors.GREEN}WORKING{Colors.RESET}" if status else f"{Colors.RED}NOT WORKING{Colors.RESET}"
    print(f"{symbol} {name:.<40} {status_text}")
    if details:
        print(f"   -> {Colors.YELLOW}{details}{Colors.RESET}")

def check_file_exists(filepath, name):
    exists = os.path.exists(filepath)
    print_check(name, exists, f"Path: {filepath}" if exists else "File not found")
    return exists

def check_backend_server():
    """Check if backend server is running"""
    try:
        import requests
        response = requests.get("http://localhost:5000/active-election", timeout=2)
        print_check("Backend Server (Flask)", True, "Running on http://localhost:5000")
        return True
    except:
        print_check("Backend Server (Flask)", False, "Not running - Start with: python backend/api/app.py")
        return False

def check_frontend_server():
    """Check if frontend server is running"""
    try:
        import requests
        response = requests.get("http://localhost:3000", timeout=2)
        print_check("Frontend Server (Next.js)", True, "Running on http://localhost:3000")
        return True
    except:
        print_check("Frontend Server (Next.js)", False, "Not running - Start with: cd frontend && npm run dev")
        return False

def check_database():
    """Check database and tables"""
    db_path = "backend/api/voting.db"
    if not os.path.exists(db_path):
        print_check("SQLite Database", False, "Database file not found")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check required tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]

        # Tables actually created by app.py. OTP codes are held in memory,
        # and the local ledger is the `blocks` table (see services/blockchain.py).
        required_tables = ['voters', 'elections', 'candidates', 'votes', 'blocks']
        missing_tables = [t for t in required_tables if t not in tables]

        if missing_tables:
            print_check("Database Schema", False, f"Missing tables: {', '.join(missing_tables)}")
            conn.close()
            return False

        # Count records
        cursor.execute("SELECT COUNT(*) FROM voters")
        voter_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM elections")
        election_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM candidates")
        candidate_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM votes")
        vote_count = cursor.fetchone()[0]

        print_check("SQLite Database", True, f"Voters: {voter_count}, Elections: {election_count}, Candidates: {candidate_count}, Votes: {vote_count}")
        conn.close()
        return True
    except Exception as e:
        print_check("Database Connection", False, f"Error: {str(e)}")
        return False

def check_python_dependencies():
    """Check if required Python packages are installed"""
    required_packages = [
        'flask', 'flask_cors', 'deepface', 'cv2', 'numpy',
        'jwt', 'firebase_admin', 'python-dotenv', 'web3'
    ]

    missing = []
    for package in required_packages:
        try:
            if package == 'cv2':
                __import__('cv2')
            elif package == 'python-dotenv':
                __import__('dotenv')
            else:
                __import__(package)
        except ImportError:
            missing.append(package)

    if missing:
        print_check("Python Dependencies", False, f"Missing: {', '.join(missing)}")
        print(f"   {Colors.YELLOW}Install with: pip install {' '.join(missing)}{Colors.RESET}")
        return False
    else:
        print_check("Python Dependencies", True, "All required packages installed")
        return True

def check_node_dependencies():
    """Check if Node.js dependencies are installed"""
    if os.path.exists("frontend/node_modules"):
        print_check("Node.js Dependencies", True, "node_modules folder exists")
        return True
    else:
        print_check("Node.js Dependencies", False, "node_modules not found")
        print(f"   {Colors.YELLOW}Install with: cd frontend && npm install{Colors.RESET}")
        return False

def check_env_file():
    """Check .env configuration"""
    env_path = "backend/api/.env"
    if not os.path.exists(env_path):
        print_check("Environment Configuration", False, ".env file not found")
        return False

    with open(env_path, 'r') as f:
        content = f.read()

    required_vars = ['ETH_RPC_URL', 'ETH_PRIVATE_KEY', 'ETH_CONTRACT_ADDRESS']
    configured = all(var in content for var in required_vars)

    if configured:
        print_check("Environment Configuration", True, "Ethereum config found")
    else:
        print_check("Environment Configuration", False, "Ethereum variables incomplete")

    return True

def check_directories():
    """Check required directories"""
    dirs = {
        "Face Storage": "backend/api/faces",
        "Party Symbols": "backend/api/party_symbols",
        "Uploads": "backend/api/uploads"
    }

    all_exist = True
    for name, path in dirs.items():
        exists = os.path.exists(path)
        print_check(name, exists, f"Path: {path}")
        all_exist = all_exist and exists

    return all_exist

def check_blockchain_services():
    """Check blockchain service files"""
    files = {
        "Local Blockchain": "backend/services/blockchain.py",
        "Ethereum Integration": "backend/services/ethereum.py",
        "Liveness Detection": "backend/services/liveness.py"
    }

    all_exist = True
    for name, path in files.items():
        exists = os.path.exists(path)
        print_check(name, exists, f"Path: {path}")
        all_exist = all_exist and exists

    return all_exist

def main():
    print(f"{Colors.BOLD}{Colors.GREEN}")
    print("""
    ============================================================

            Smart Voting System - Status Checker

    ============================================================
    """)
    print(Colors.RESET)

    results = {}

    # 1. Check Files & Directories
    print_header("FILE STRUCTURE")
    results['database'] = check_file_exists("backend/api/voting.db", "Database File")
    results['app'] = check_file_exists("backend/api/app.py", "Main Backend App")
    results['env'] = check_env_file()
    results['directories'] = check_directories()

    # 2. Check Dependencies
    print_header("DEPENDENCIES")
    results['python_deps'] = check_python_dependencies()
    results['node_deps'] = check_node_dependencies()

    # 3. Check Database
    print_header("DATABASE")
    results['db_schema'] = check_database()

    # 4. Check Services
    print_header("BLOCKCHAIN SERVICES")
    results['blockchain'] = check_blockchain_services()

    # 5. Check Running Servers
    print_header("RUNNING SERVERS")
    results['backend'] = check_backend_server()
    results['frontend'] = check_frontend_server()

    # Summary
    print_header("SUMMARY")
    working = sum(1 for v in results.values() if v)
    total = len(results)
    percentage = (working / total) * 100

    print(f"Status: {working}/{total} checks passed ({percentage:.1f}%)\n")

    if percentage == 100:
        print(f"{Colors.GREEN}[OK] All systems operational!{Colors.RESET}")
    elif percentage >= 70:
        print(f"{Colors.YELLOW}[!] System mostly ready - few items need attention{Colors.RESET}")
    else:
        print(f"{Colors.RED}[X] System needs setup - multiple components missing{Colors.RESET}")

    # Next steps
    print(f"\n{Colors.BOLD}NEXT STEPS:{Colors.RESET}")
    if not results['backend']:
        print(f"1. Start backend:  {Colors.BLUE}python backend/api/app.py{Colors.RESET}")
    if not results['frontend']:
        print(f"2. Start frontend: {Colors.BLUE}cd frontend && npm run dev{Colors.RESET}")
    if not results['python_deps']:
        print(f"3. Install Python packages: {Colors.BLUE}pip install -r requirements.txt{Colors.RESET}")
    if not results['node_deps']:
        print(f"4. Install Node packages: {Colors.BLUE}cd frontend && npm install{Colors.RESET}")

    print()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Check cancelled by user{Colors.RESET}")
        sys.exit(0)
    except Exception as e:
        print(f"\n{Colors.RED}Error: {str(e)}{Colors.RESET}")
        sys.exit(1)
