#!/bin/bash
TARGET_DIR="/home/david/workspaceToit/toit/lib"

echo "Testing all .toit files in $TARGET_DIR..."
fail_count=0
pass_count=0
rm -f failures.log

while IFS= read -r file; do
    output=$(npx tree-sitter parse -q "$file" 2>&1)
    if [ $? -eq 0 ]; then
        pass_count=$((pass_count+1))
    else
        echo "FAILED: $file"
        echo "FAILED: $file" >> failures.log
        echo "$output" >> failures.log
        echo "-----------------------------------" >> failures.log
        fail_count=$((fail_count+1))
    fi
done < <(find "$TARGET_DIR" -type f -name "*.toit")

echo "============================"
echo "Total passed: $pass_count"
echo "Total failed: $fail_count"
