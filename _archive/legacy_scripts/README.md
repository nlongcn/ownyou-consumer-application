# Legacy Scripts Archive

**Archived:** 2025-10-13
**Reason:** Deprecated scripts superseded by unified CLI interface

## Contents

This folder contains Python scripts from earlier development phases that have been superseded by the unified CLI entry point at `src/email_parser/main.py`.

### Archived Scripts

- **email_downloader_old.py** - Early email download implementation
- **email_processsor.py** - Early email processing script (note: typo in filename)
- **fix_logging.py** - Temporary logging fix script
- **install.py** - Legacy installation script
- **run.py** - Legacy run script
- **setup_accounts.py** - Early account setup script
- **test_config.py** - Configuration testing script

## Current Implementation

All functionality from these scripts has been consolidated into the unified CLI:

```bash
# Current way to use the system
python -m src.email_parser.main [options]

# See all available commands
python -m src.email_parser.main --help
```

For setup and configuration, use:
```bash
python -m src.email_parser.main setup
```

## Why Deprecated?

These scripts were replaced to:
1. **Unified interface** - Single entry point for all operations
2. **Better organization** - Modular package structure
3. **Improved maintainability** - Centralized configuration and error handling
4. **Enhanced features** - Support for multiple providers and models

## Related Documentation

- `/README.md` - Current project overview
- `/CLAUDE.md` - Current usage guidelines
- `/docs/development/BEST_PRACTICES.md` - Development standards

---

**Note:** These scripts are preserved for historical reference only. Do not use them for current development.
