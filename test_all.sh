#!/bin/bash
TARGET_DIR="/home/david/workspaceToit/toit"
if [ ! -d "$TARGET_DIR" ]; then
  echo "Directory $TARGET_DIR does not exist."
  exit 1
fi

source /home/david/apps/tresit/.venv/bin/activate

echo "Testing all .toit files in $TARGET_DIR..."
fail_count=0
pass_count=0

# Use process substitution instead of a pipe so fail_count updates in current shell
while IFS= read -r file; do
    if (ulimit -v 2000000; timeout 0.5s npx tree-sitter parse -q "$file" > /dev/null 2>&1); then
        pass_count=$((pass_count+1))
    else
        echo "FAILED: $file"
        fail_count=$((fail_count+1))
    fi
done < <(find "$TARGET_DIR" -type f -name "*.toit")

echo "============================"
echo "Total passed: $pass_count"
echo "Total failed: $fail_count"
