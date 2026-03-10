# Toit Parser Tests

This directory contains minimal reproduction cases created while debugging Tree-sitter parser issues, specifically conflicts involving `::=`, `task::`, and unexpected EOF loops.

## Test Cases

| File | Purpose |
| ---- | ------- |
| `1_test_assign.toit` | Isolates basic variable assignment using the `::=` operator to rule out basic syntax errors. |
| `2_test_task.toit` | Isolates a single `task:: wait_on_jag false` block function call to rule out basic syntax errors with double colons. |
| `3_test_task2.toit` | Isolates two consecutive `task::` blocks to verify the parser correctly handles back-to-back double colon blocks without argument bleed. |
| `4_test_task3.toit` | Same as `test_task2.toit` but with arguments passed to the task expressions, verifying the arguments aren't misparsed into the subsequent block. |
| `5_test_combined_1.toit` | Replicates the exact sequence of statements from `thpv.toit` lines 23-29, combining `::=` assignment, an `if` block, and consecutive `task::` blocks. (Used to isolate the `DEDENT` newline bug). |
| `6_test_combined_2.toit` | A variant of `test_combined_1` using `:=` instead of `::=` to rule out the operator preceding the block as the root cause of the error. |

*Note: The root cause across the `test_combined` suite was an overzealous `queued_newline = true` in the `src/scanner.c` emitting phantom `NEWLINE` tokens upon `DEDENT`, disrupting subsequent inline block evaluation.*
