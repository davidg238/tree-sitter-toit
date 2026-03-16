import subprocess
import sys

with open('/home/david/workspaceToit/toit/lib/core/string.toit') as f:
    lines = f.readlines()

# Try bisecting by removing lines from the bottom
for i in range(len(lines), 0, -1):
    with open('test_loop.toit', 'w') as f:
        f.writelines(lines[:i])
    try:
        res = subprocess.run(['timeout', '0.5s', 'npx', 'tree-sitter', 'parse', 'test_loop.toit'], capture_output=True)
        if res.returncode != 124: # Not timeout
            # That means line i was the culprit!
            print(f"Loop stops when excluding line {i+1}:\n{lines[i]}")
            break
    except Exception as e:
        print(e)
