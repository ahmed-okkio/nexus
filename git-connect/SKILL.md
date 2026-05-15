---
name: git-connect
description: Initializes a new git repository and configures remote GitHub connection. Use when starting a new project or connecting an existing local directory to a new remote repository.
---

# Git Connect Skill

Use this skill to automate the setup of a git repository and link it to GitHub.

## Workflow

1. **Initialize**: Run `git init`.
2. **Setup Remote**: Define the remote origin.
3. **Configure**: Set the default branch to `main`.

## Usage

When you need to connect to a new repository, ask Gemini to "connect this project to a new git repository". Provide the GitHub repository URL when prompted.

## Example

- "git-connect https://github.com/user/repo.git"
