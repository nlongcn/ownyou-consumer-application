#!/usr/bin/env python3
"""
Script to fix structured logging calls in the codebase.
"""

import re
import sys

def fix_structured_logging(file_path):
    """Fix structured logging calls in a file."""
    with open(file_path, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Pattern to match self.logger calls with keyword arguments
    pattern = r'self\.logger\.(info|debug|warning|error)\(\s*(["\'])(.*?)\2\s*,\s*([^)]*[a-zA-Z_]+=.*?)\)'
    
    def replace_logging_call(match):
        method = match.group(1)
        quote = match.group(2)
        message = match.group(3)
        kwargs = match.group(4)
        
        # Extract key-value pairs from kwargs
        kv_pairs = []
        for kv in re.findall(r'([a-zA-Z_]+)\s*=\s*([^,)]+)', kwargs):
            key, value = kv
            kv_pairs.append(f"{key}: {{{value}}}")
        
        # Create formatted string
        if kv_pairs:
            formatted_message = f"{message} - {', '.join(kv_pairs)}"
            return f'self.logger.{method}(f{quote}{formatted_message}{quote})'
        else:
            return f'self.logger.{method}({quote}{message}{quote})'
    
    # Apply replacements
    new_content = re.sub(pattern, replace_logging_call, content, flags=re.DOTALL)
    
    # Write back if changed
    if new_content != original_content:
        with open(file_path, 'w') as f:
            f.write(new_content)
        print(f"Fixed structured logging in {file_path}")
        return True
    else:
        print(f"No changes needed in {file_path}")
        return False

if __name__ == "__main__":
    file_path = "/Volumes/T7_new/developer_old/email_parser/src/email_parser/main.py"
    fix_structured_logging(file_path)