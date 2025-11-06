# Old Credentials Archive

**Archived:** 2025-10-13
**Status:** ⚠️ **FILES RESTORED** - These files were incorrectly archived

## ⚠️ Important Note

**These files have been restored to the root directory** as they are still actively used by the Gmail provider.

The files that were temporarily archived here:
- `credentials.json` - **ACTIVE** Google OAuth credentials (RESTORED)
- `token.json` - **ACTIVE** Gmail OAuth token (RESTORED)
- `token.pickle` - **ACTIVE** Gmail pickle-format token (RESTORED)

## Why Were They Restored?

Testing revealed that the Gmail provider (`src/email_parser/providers/gmail_provider.py:59-60`) expects these files in the root directory:
- `credentials.json` - Default Gmail credentials file
- `token.json` - Default Gmail token file

These are **NOT** old/deprecated files - they are current, active authentication files required for Gmail integration.

## Current Authentication Files

**In project root (active):**
- `credentials.json` - Google OAuth credentials (Gmail)
- `token.json` - Gmail OAuth token
- `token.pickle` - Gmail token (pickle format)
- `ms_token.json` - Microsoft OAuth token (Outlook)
- `msal_token_cache.bin` - MSAL token cache (Outlook)

### Setup Current Authentication

```bash
# Interactive setup for all providers
python -m src.email_parser.main setup

# Setup specific provider
python -m src.email_parser.main setup gmail
python -m src.email_parser.main setup outlook

# Check authentication status
python -m src.email_parser.main setup status
```

## Lesson Learned

This archive folder serves as a reminder that **testing is critical** after making changes to file organization. The cleanup process initially moved these files assuming they were deprecated, but end-to-end testing revealed they are still actively required.

## Safe to Delete This Folder?

**Yes, this folder is now empty** and can be safely deleted. All files have been restored to their correct locations in the project root.

---

**Note:** This folder documents a mistake caught during testing. Always run comprehensive tests after repository cleanup to ensure nothing breaks.
