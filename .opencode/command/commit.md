---
description: Stage recent changes and auto-commit with an English Conventional Commit
agent: build
subtask: true
---

You are a senior release engineer. Perform a staged auto-commit:

1) Stage changes (prioritize user arguments if provided):

!`echo "$ARGUMENTS" | awk '{for(i=1;i<=NF;i++)print $i}' | xargs -r git add --`
!`git add -u`
!`git ls-files --others --exclude-standard | xargs -r git add --`

2) Display staged status:

**Staged files:**
!`git diff --cached --name-status`

3) From the staged diff, generate the **best English Conventional Commit message**, with:
- Subject ≤ 72 chars, imperative mood;
- Proper type/scope;
- Informative body (rationale, impact, key changes);
- Footers for issues and BREAKING CHANGE when applicable.

Now print the final `git commit` command **exactly** as it will run, then execute it:

- Command (preview):
\`\`\`
git commit -m "<subject line>" -m "<body + footers>"
\`\`\`

After printing, **execute** the commit command with the exact subject/body you produced.
If there is **nothing staged**, print "No changes to commit" and exit gracefully.
