#!/usr/bin/env python3
"""
Skill Enforcement Hook for Claude Code

This hook runs on PreToolUse for Edit/Write/Bash tools to ensure
that Claude has used the Skill tool before making changes.

Exit codes:
- 0: Success (allow tool use)
- 2: Blocking error (deny tool use)
"""
import json
import sys
from pathlib import Path

# Tools that require skill usage before execution
PROTECTED_TOOLS = {"Edit", "Write", "Bash"}

# Tools exempt from skill checks (read-only or meta tools)
EXEMPT_TOOLS = {
    "Read", "Glob", "Grep", "Task", "TodoWrite", "Skill",
    "AskUserQuestion", "WebFetch", "WebSearch"
}

# Keywords that indicate implementation work requiring skills
IMPLEMENTATION_KEYWORDS = [
    "implement", "sprint", "feature", "fix", "bug", "refactor",
    "add", "create", "build", "develop", "code", "test"
]

def load_transcript(transcript_path: str) -> list:
    """Load conversation transcript from JSONL file."""
    messages = []
    try:
        with open(transcript_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        messages.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    except (IOError, FileNotFoundError):
        pass
    return messages

def skill_was_used(messages: list) -> bool:
    """Check if Skill tool was invoked in the conversation."""
    for msg in messages:
        # Check for Skill tool usage in assistant messages
        if msg.get("role") == "assistant":
            content = msg.get("content", "")
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict):
                        # Check for tool_use blocks
                        if block.get("type") == "tool_use":
                            if block.get("name") == "Skill":
                                return True
                        # Check text content
                        text = block.get("text", "")
                        if "Skill(" in text or "I'm using" in text:
                            return True
            elif isinstance(content, str):
                if "Skill(" in content or "I'm using" in content:
                    return True

        # Check tool results for skill execution
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict):
                        tool_result = block.get("content", "")
                        if "Launching skill:" in str(tool_result):
                            return True
                        if "skill is running" in str(tool_result).lower():
                            return True
    return False

def is_implementation_task(messages: list) -> bool:
    """Detect if this is an implementation task requiring skills."""
    # Check user messages for implementation keywords
    for msg in messages:
        if msg.get("role") == "user":
            content = str(msg.get("content", "")).lower()
            for keyword in IMPLEMENTATION_KEYWORDS:
                if keyword in content:
                    return True
    return False

def is_first_edit(messages: list, tool_name: str) -> bool:
    """Check if this is the first Edit/Write/Bash in the conversation."""
    edit_count = 0
    for msg in messages:
        if msg.get("role") == "assistant":
            content = msg.get("content", "")
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_use":
                        if block.get("name") in PROTECTED_TOOLS:
                            edit_count += 1
    # First 3 edits should require skill check
    return edit_count < 3

def main():
    # Load hook input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        # Can't parse input, allow through
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    transcript_path = input_data.get("transcript_path", "")

    # Skip check for exempt tools
    if tool_name in EXEMPT_TOOLS or tool_name not in PROTECTED_TOOLS:
        sys.exit(0)

    # Load conversation history
    messages = load_transcript(transcript_path)

    # Skip check if skill was already used
    if skill_was_used(messages):
        sys.exit(0)

    # Skip check if this isn't an implementation task
    if not is_implementation_task(messages):
        sys.exit(0)

    # Skip check if this isn't one of the first edits
    if not is_first_edit(messages, tool_name):
        sys.exit(0)

    # BLOCK: Implementation task without skill usage
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                "SKILL ENFORCEMENT: You are attempting to use {tool} without "
                "first using a skill. For implementation tasks, you MUST:\n\n"
                "1. Identify relevant skills (sprint-mode, testing-discipline, etc.)\n"
                "2. Use the Skill tool to invoke them\n"
                "3. Announce: 'I'm using [skill] to [task]'\n"
                "4. Follow the skill's workflow\n\n"
                "Please use the appropriate skill before making changes."
            ).format(tool=tool_name)
        }
    }

    print(json.dumps(output))
    sys.exit(0)

if __name__ == "__main__":
    main()
