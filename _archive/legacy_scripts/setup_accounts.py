#!/usr/bin/env python3
"""
Quick account setup runner (bypasses installation)
"""

import sys
import os
from pathlib import Path

# Add src to Python path
project_root = Path(__file__).parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))

def main():
    """Run account setup directly."""
    try:
        # Set up sys.argv for setup command
        if len(sys.argv) == 1:
            # Interactive setup
            sys.argv.append("setup")
        else:
            # Pass through arguments but ensure setup is first
            args = sys.argv[1:]
            sys.argv = ["setup_accounts.py", "setup"] + args
        
        from email_parser.main import main as email_main
        email_main()
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("\\n🔧 TROUBLESHOOTING:")
        print("1. Make sure you're in the email_parser directory")
        print("2. Install requirements: pip install -r requirements.txt")
        print("3. Try: python install.py")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\\n\\n👋 Setup cancelled by user.")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Setup error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("🚀 Email Parser - Account Setup")
    print("=" * 35)
    main()