#!/usr/bin/env python3
"""
Quick installer for Email Parser
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(cmd, description):
    """Run a command and handle errors."""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e}")
        if e.stdout:
            print(f"   stdout: {e.stdout}")
        if e.stderr:
            print(f"   stderr: {e.stderr}")
        return False

def main():
    """Main installation process."""
    print("🚀 Email Parser - Quick Installer")
    print("=" * 40)
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ required")
        sys.exit(1)
    
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")
    
    # Install in development mode
    print("\\n📦 Installing Email Parser...")
    
    if run_command("pip install -e .", "Installing package in development mode"):
        print("\\n🎉 Installation completed successfully!")
        print("\\n🔧 USAGE COMMANDS:")
        print("   email-parser setup              # Interactive account setup")
        print("   email-parser setup gmail        # Setup Gmail account")  
        print("   email-parser setup outlook      # Setup Outlook account")
        print("   email-parser setup status       # Check account status")
        print("   email-parser --provider gmail --max-emails 10  # Process emails")
        
        print("\\n📋 ALTERNATIVE COMMANDS (if above don't work):")
        print("   python -m email_parser.main setup")
        print("   python -m email_parser.main --provider gmail --max-emails 10")
        
        print("\\n💡 QUICK START:")
        print("1. Run: email-parser setup")
        print("2. Follow the guided setup for your email provider")
        print("3. Run: email-parser --provider gmail --max-emails 50")
        print("4. Check your emails_processed.csv file!")
        
    else:
        print("\\n❌ Installation failed")
        print("\\n🔧 MANUAL INSTALLATION:")
        print("1. cd into the email_parser directory")
        print("2. pip install -r requirements.txt")
        print("3. cd src")
        print("4. python -m email_parser.main setup")
        
        sys.exit(1)

if __name__ == "__main__":
    main()