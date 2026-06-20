#!/bin/bash

echo "🔍 Frontend Rating Feature Setup Verification"
echo "=============================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASSED=0
FAILED=0

# Check 1: RatingPrompt component exists
echo -n "✓ Checking RatingPrompt.jsx... "
if [ -f "src/components/RatingPrompt.jsx" ]; then
  echo -e "${GREEN}FOUND${NC}"
  ((PASSED++))
else
  echo -e "${RED}MISSING${NC}"
  ((FAILED++))
fi

# Check 2: RatingModal component exists
echo -n "✓ Checking RatingModal.jsx... "
if [ -f "src/components/RatingModal.jsx" ]; then
  echo -e "${GREEN}FOUND${NC}"
  ((PASSED++))
else
  echo -e "${RED}MISSING${NC}"
  ((FAILED++))
fi

# Check 3: StarRating component exists
echo -n "✓ Checking StarRating.jsx... "
if [ -f "src/components/StarRating.jsx" ]; then
  echo -e "${GREEN}FOUND${NC}"
  ((PASSED++))
else
  echo -e "${RED}MISSING${NC}"
  ((FAILED++))
fi

# Check 4: ratingService.js exists
echo -n "✓ Checking ratingService.js... "
if [ -f "src/services/ratingService.js" ]; then
  echo -e "${GREEN}FOUND${NC}"
  ((PASSED++))
else
  echo -e "${RED}MISSING${NC}"
  ((FAILED++))
fi

# Check 5: RatingPrompt imported in UserDashboard
echo -n "✓ Checking RatingPrompt imported in UserDashboard... "
if grep -q "import RatingPrompt" src/screens/user/Component/UserDashboard/Dashboard/UserDashboard.jsx; then
  echo -e "${GREEN}IMPORTED${NC}"
  ((PASSED++))
else
  echo -e "${RED}NOT IMPORTED${NC}"
  ((FAILED++))
fi

# Check 6: RatingPrompt mounted in UserDashboard
echo -n "✓ Checking RatingPrompt mounted in UserDashboard... "
if grep -q "<RatingPrompt" src/screens/user/Component/UserDashboard/Dashboard/UserDashboard.jsx; then
  echo -e "${GREEN}MOUNTED${NC}"
  ((PASSED++))
else
  echo -e "${RED}NOT MOUNTED${NC}"
  ((FAILED++))
fi

# Check 7: Old rating code removed from ChatBox
echo -n "✓ Checking old rating code removed from ChatBox... "
if ! grep -q "import RatingModal\|import ratingService\|handleSubmitRating\|ratingPromptedRef" src/screens/user/Component/UserDashboard/Tab/ChatBox/ChatBox.jsx; then
  echo -e "${GREEN}REMOVED${NC}"
  ((PASSED++))
else
  echo -e "${RED}STILL PRESENT${NC}"
  ((FAILED++))
fi

# Check 8: axiosConfig has rating endpoints
echo -n "✓ Checking axiosConfig API endpoints... "
if grep -q "LOCAL_5001\|API_ENDPOINTS" src/axiosConfig.js; then
  echo -e "${GREEN}CONFIGURED${NC}"
  ((PASSED++))
else
  echo -e "${RED}NOT CONFIGURED${NC}"
  ((FAILED++))
fi

echo ""
echo "=============================================="
echo -e "Results: ${GREEN}${PASSED} PASSED${NC} | ${RED}${FAILED} FAILED${NC}"
echo "=============================================="

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All frontend checks passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some checks failed!${NC}"
  exit 1
fi
