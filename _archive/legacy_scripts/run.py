#!/usr/bin/env python3
"""
Direct runner for Email Parser (bypasses installation)
"""

import sys
import os
from pathlib import Path

# Add src to Python path
project_root = Path(__file__).parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))

def main():
    """Run Email Parser directly."""
    try:
        from email_parser.main import main as email_main
        email_main()
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("\\n🔧 TROUBLESHOOTING:")
        print("1. Make sure you're in the email_parser directory")
        print("2. Install requirements: pip install -r requirements.txt")
        print("3. Try: python install.py")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()