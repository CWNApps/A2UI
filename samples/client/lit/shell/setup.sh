#!/bin/bash
# Quick start guide for setting up and running the GenUI client with Agent trigger fix

echo "╔════════════════════════════════════════════════════════════╗"
echo "║    GenUI Client Setup - HTTP 422 Agent Trigger Fix        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Install dependencies
echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
npm install dotenv cors express
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi

# Step 2: Setup environment
echo ""
echo -e "${YELLOW}Step 2: Setting up environment file...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo -e "${YELLOW}⚠ Please edit .env and add your API credentials${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Step 3: Verify setup
echo ""
echo -e "${YELLOW}Step 3: Verifying configuration...${NC}"
if grep -q "your_api_key" .env; then
    echo -e "${RED}✗ Please update .env with your actual API key${NC}"
    exit 1
else
    echo -e "${GREEN}✓ API key configured${NC}"
fi

# Step 4: Start backend proxy
echo ""
echo -e "${YELLOW}Step 4: Starting backend proxy server...${NC}"
echo -e "${GREEN}Starting: node server.js${NC}"
echo ""

# Show startup message
node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Test health endpoint
echo ""
echo -e "${YELLOW}Testing health endpoint...${NC}"
if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo -e "${GREEN}✓ Server is running and healthy${NC}"
else
    echo -e "${RED}✗ Server health check failed${NC}"
    kill $SERVER_PID
    exit 1
fi

# Step 5: Instructions
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              Setup Complete!                              ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  Backend Proxy Server is running on:                      ║"
echo "║  http://localhost:3000                                    ║"
echo "║                                                            ║"
echo "║  Available Endpoints:                                     ║"
echo "║  • POST /api/agent - Universal agent proxy               ║"
echo "║  • POST /api/agent/trigger - Direct trigger endpoint     ║"
echo "║  • GET  /health - Server health check                    ║"
echo "║                                                            ║"
echo "║  In another terminal, start the GenUI client:            ║"
echo "║  npm run dev                                              ║"
echo "║                                                            ║"
echo "║  The client will use the backend proxy to communicate    ║"
echo "║  with the Relevance AI agent trigger endpoint.           ║"
echo "║                                                            ║"
echo "║  This eliminates HTTP 422 errors by:                     ║"
echo "║  ✓ Injecting required 'role' property                   ║"
echo "║  ✓ Validating payloads recursively                      ║"
echo "║  ✓ Implementing retry with exponential backoff           ║"
echo "║  ✓ Providing detailed error messages                    ║"
echo "║                                                            ║"
echo "║  See HTTP_422_FIX_GUIDE.md for more details             ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Keep the script running
wait
