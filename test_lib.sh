#!/bin/bash

LIB_DIR="/home/david/workspaceToit/toit/lib"
PARSER_DIR="/home/david/workspaceToit/tree-sitter-toit"
VENV_DIR="${VENV_DIR:-/home/david/apps/tresit/.venv}"

cd "$PARSER_DIR" || exit 1

source "$VENV_DIR/bin/activate"

SUCCESS_COUNT=0
FAIL_COUNT=0
FAIL_LIST=""

echo "Starting parse of $LIB_DIR..."

# Pre-build the parser so it doesn't need to compile under ulimit
tree-sitter build 2>/dev/null

# Use find to get all .toit files
while IFS= read -r file; do
    # Run with a 0.5 second timeout and quiet mode (only prints errors or success status)
    # tree-sitter parse returns 0 if successful, 1 if parsing failed, 124 if timed out
    (ulimit -v 2000000; timeout 2s tree-sitter parse "$file" -q > /dev/null 2>&1)
    STATUS=$?

    if [ $STATUS -eq 0 ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "Failed: $file (Exit code: $STATUS)"
        FAIL_LIST="$FAIL_LIST\n$file"
    fi
done < <(find "$LIB_DIR" -type f -name "*.toit")

echo "----------------------------------------"
echo "Parse Results:"
echo "SUCCESS: $SUCCESS_COUNT"
echo "FAILED:  $FAIL_COUNT"
echo
echo "Failed files:"
echo -e "$FAIL_LIST"

# Save the fail list for reference
mkdir -p tmp
echo -e "$FAIL_LIST" > tmp/failures.log
