#!/bin/bash
###############################################################################
# Azure App Registration Setup (CLI-based)
#
# Creates Azure app registration for OAuth token lifetime testing.
# Configures as "Mobile and Desktop" platform for 90-day refresh tokens.
#
# Usage:
#   ./tests/azure-setup.sh
#
# Output:
#   - Creates app registration
#   - Configures redirect URI and public client flows
#   - Adds Microsoft Graph API permissions
#   - Outputs client ID for use in token test
###############################################################################

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Azure App Registration Setup (90-day tokens)       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Error: Azure CLI not installed"
    echo ""
    echo "Install Azure CLI:"
    echo "  macOS:   brew install azure-cli"
    echo "  Linux:   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
    echo "  Windows: https://aka.ms/installazurecliwindows"
    exit 1
fi

# Check if logged in
echo "🔐 Checking Azure CLI login status..."
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure CLI"
    echo ""
    echo "Please run:"
    echo "  az login"
    echo ""
    echo "Then run this script again."
    exit 1
fi

CURRENT_USER=$(az account show --query user.name -o tsv)
echo "✅ Logged in as: $CURRENT_USER"
echo ""

# App registration details
APP_NAME="OwnYou Email Agent (Test)"
REDIRECT_URI="https://login.microsoftonline.com/common/oauth2/nativeclient"

echo "Creating app registration..."
echo "  Name: $APP_NAME"
echo "  Type: Mobile and Desktop (Public Client)"
echo "  Redirect URI: $REDIRECT_URI"
echo ""

# Create app registration
# Note: --sign-in-audience AzureADandPersonalMicrosoftAccount = multi-tenant
APP_ID=$(az ad app create \
    --display-name "$APP_NAME" \
    --sign-in-audience "AzureADandPersonalMicrosoftAccount" \
    --enable-access-token-issuance false \
    --enable-id-token-issuance false \
    --query appId -o tsv)

if [ -z "$APP_ID" ]; then
    echo "❌ Failed to create app registration"
    exit 1
fi

echo "✅ App created successfully"
echo "   Application (client) ID: $APP_ID"
echo ""

# Configure as public client (allows native/mobile flows)
echo "Configuring public client flows..."
az ad app update \
    --id "$APP_ID" \
    --set publicClient.redirectUris="[\"$REDIRECT_URI\"]" \
    --is-fallback-public-client true

echo "✅ Public client flows enabled"
echo ""

# Add Microsoft Graph API permissions
echo "Adding Microsoft Graph API permissions..."

# Get Microsoft Graph service principal ID (constant across all tenants)
GRAPH_RESOURCE_ID="00000003-0000-0000-c000-000000000000"

# Permission IDs for Microsoft Graph (these are constant GUIDs)
# See: https://docs.microsoft.com/en-us/graph/permissions-reference
OFFLINE_ACCESS_ID="7427e0e9-2fba-42fe-b0c0-848c9e6a8182"  # offline_access
OPENID_ID="37f7f235-527c-4136-accd-4a02d197296e"          # openid
PROFILE_ID="14dad69e-099b-42c9-810b-d002981feec1"         # profile
EMAIL_ID="64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0"           # email
MAIL_READ_ID="570282fd-fa5c-430d-a7fd-fc8dc98a9dca"       # Mail.Read

# Create required resource access JSON
REQUIRED_RESOURCE_ACCESS=$(cat <<EOF
[
  {
    "resourceAppId": "$GRAPH_RESOURCE_ID",
    "resourceAccess": [
      {
        "id": "$OFFLINE_ACCESS_ID",
        "type": "Scope"
      },
      {
        "id": "$OPENID_ID",
        "type": "Scope"
      },
      {
        "id": "$PROFILE_ID",
        "type": "Scope"
      },
      {
        "id": "$EMAIL_ID",
        "type": "Scope"
      },
      {
        "id": "$MAIL_READ_ID",
        "type": "Scope"
      }
    ]
  }
]
EOF
)

# Update app with required permissions
az ad app update \
    --id "$APP_ID" \
    --required-resource-accesses "$REQUIRED_RESOURCE_ACCESS"

echo "✅ API permissions added:"
echo "   - offline_access (refresh tokens)"
echo "   - openid (user identity)"
echo "   - profile (user profile)"
echo "   - email (user email address)"
echo "   - Mail.Read (read user emails)"
echo ""

echo "⚠️  IMPORTANT: Admin consent required for Mail.Read"
echo ""
echo "Since you don't have access to Azure Portal, you have two options:"
echo ""
echo "Option 1: Grant admin consent via Azure CLI (if you're admin):"
echo "  az ad app permission admin-consent --id $APP_ID"
echo ""
echo "Option 2: User consent during first login:"
echo "  - When you run the token test, you'll be prompted to consent"
echo "  - This works for personal Microsoft accounts"
echo "  - For work/school accounts, may require admin approval"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    SETUP COMPLETE                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Your Azure app registration is ready for testing!"
echo ""
echo "📋 Application Details:"
echo "   Name: $APP_NAME"
echo "   Client ID: $APP_ID"
echo "   Platform: Mobile and Desktop (Public Client)"
echo "   Redirect URI: $REDIRECT_URI"
echo "   Token Lifetime: 90 days (if configured correctly)"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "1. Set environment variable:"
echo "   export AZURE_CLIENT_ID=\"$APP_ID\""
echo ""
echo "2. Run token lifetime test:"
echo "   node tests/oauth-token-lifetime-test.js"
echo ""
echo "3. Complete authentication when prompted"
echo ""
echo "4. Wait 25 hours"
echo ""
echo "5. Run test again to verify 90-day token behavior"
echo ""
echo "📖 For detailed instructions, see:"
echo "   tests/README_TOKEN_LIFETIME_TEST.md"
echo ""

# Save client ID to file for convenience
echo "$APP_ID" > .azure-client-id
echo "💾 Client ID saved to: .azure-client-id"
echo ""
