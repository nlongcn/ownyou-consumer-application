import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
REPO_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = REPO_ROOT / '.env'
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)

# Ensure project src is on sys.path for tests
SRC_PATH = REPO_ROOT / 'src'
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

