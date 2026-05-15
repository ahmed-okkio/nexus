---
name: show-time
description: Displays the current time. Use this skill when the user asks to see the current time or needs a script to output the current time.
---

# Show Time

## Overview
This skill provides a simple script to display the current time. It is useful for quickly getting the current time in a consistent format.

## Usage

To display the current time, you can execute the `display_current_time.sh` script located in the `scripts/` directory of this skill.

```bash
run_shell_command "scripts/display_current_time.sh"
```

## Resources

This skill includes a script to display the current time:

### scripts/
Executable code that can be run directly to perform specific operations.

- `display_current_time.sh`: A simple Bash script that outputs the current time in `HH:MM:SS` format.
