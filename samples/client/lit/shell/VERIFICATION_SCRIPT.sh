#!/bin/bash

# Test checklist for Relevance AI integration fixes
# Run these commands locally to verify the app works correctly

set -e

cd /workspaces/A2UI/samples/client/lit/shell

echo "🔍 Checking environment variables..."
echo "✓ VITE_RELEVANCE_STACK_BASE: ${VITE_RELEVANCE_STACK_BASE:-(not set)}"
echo "✓ VITE_RELEVANCE_AGENT_ID: ${VITE_RELEVANCE_AGENT_ID:-(not set)}"
echo "✓ VITE_RELEVANCE_TOOL_ID: ${VITE_RELEVANCE_TOOL_ID:-(not set)}"
echo "✓ VITE_RELEVANCE_PROJECT_ID: ${VITE_RELEVANCE_PROJECT_ID:-(not set)}"

echo ""
echo "🏗️  Building project..."
npm run build

echo ""
echo "✅ Build successful!"
echo ""
echo "📝 Summary of changes:"
echo "  - Created src/lib/relevanceConfig.ts: Centralized config management"
echo "  - Created src/lib/extractUiPayload.ts: Robust response extraction"
echo "  - Updated app.ts: Exponential backoff polling, proper error handling"
echo "  - Created vercel.json: SPA routing with filesystem handling"
echo ""
echo "🚀 To deploy to Vercel:"
echo "  1. Ensure all env vars are set in Vercel project settings"
echo "  2. Redeploy to rebuild with new config"
echo "  3. Check Network tab in browser DevTools:"
echo "     - Should see /latest/agents/trigger or /latest/studios/*/trigger_async"
echo "     - NO /latest/latest/... paths"
echo "     - Auth header should be 'Basic ...'"
echo ""
echo "📊 To test locally:"
echo "  npm run dev"
echo "  # Open browser to http://localhost:5173"
echo "  # Submit a message and check browser console:"
echo "  # Should see [RelevanceRouter] logs showing normalized URLs"
