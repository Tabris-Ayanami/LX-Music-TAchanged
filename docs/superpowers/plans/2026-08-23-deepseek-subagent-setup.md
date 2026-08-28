# DeepSeek Subagent Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install and validate a Windows-compatible DeepSeek child-agent integration without changing the LX Music application or exposing API credentials.

**Architecture:** Keep the Codex parent on its existing OpenAI provider and install the `oil-oil/codex-deepseek-subagent` user-level skill. The integration stores credentials in Windows Credential Manager, adds a dedicated DeepSeek role, and requires a new Codex task after setup for native routing verification.

**Tech Stack:** Codex Desktop, Python 3.11+, Windows Credential Manager, DeepSeek Responses API

**Spec:** User request in the current Codex task to evaluate three repositories and reuse a safe existing implementation.

## Global Constraints

- Never place a DeepSeek API key in the repository, command line, task transcript, temporary file, or generated report.
- Do not change the LX Music source tree except for this plan document.
- Keep the parent Codex model and provider unchanged.
- Do not run a billed DeepSeek smoke test until a credential is available and the user has selected Flash or Pro.

---

### Task 1: Select the compatible implementation

**Files:**
- Read: the three candidate repositories in an isolated temporary audit directory
- Create: none

**Interfaces:**
- Consumes: repository documentation, source, security notes, and platform support
- Produces: one selected GitHub skill path suitable for Windows Codex Desktop

- [x] **Step 1: Clone all three repositories into an isolated temporary directory.**
- [x] **Step 2: Verify platform support, license, credential storage, configuration mutations, and rollback behavior.**
- [x] **Step 3: Select `oil-oil/codex-deepseek-subagent/codex-deepseek-subagent`; reject the Linux-only patched binary and the plaintext handoff design.**

### Task 2: Install the user-level skill

**Files:**
- Create: `C:/Users/asus/.codex/skills/codex-deepseek-subagent/`
- Test: installed `SKILL.md` and manager script discovery

**Interfaces:**
- Consumes: the selected GitHub repository and Codex skill installer
- Produces: an installed configuration-management skill available to new Codex tasks

- [x] **Step 1: Confirm the destination skill directory does not already exist.**
- [x] **Step 2: Install the selected repository path with the bundled Codex skill installer.**
- [x] **Step 3: Compare the installed manager script hash with the audited source.**

### Task 3: Run non-secret readiness checks

**Files:**
- Read: `C:/Users/asus/.codex/config.toml`
- Read: `C:/Users/asus/.codex/skills/codex-deepseek-subagent/`
- Test: `codex_deepseek.py status --json`

**Interfaces:**
- Consumes: installed skill and current Codex Desktop runtime
- Produces: structured readiness status without printing a credential

- [x] **Step 1: Check only whether `DEEPSEEK_API_KEY` exists; never print its value.**
- [x] **Step 2: Run the manager's read-only status command.**
- [x] **Step 3: If no credential exists, stop before setup and report the exact local action required from the user.**

### Task 4: Complete setup after credential and model selection

**Files:**
- Modify transactionally: `C:/Users/asus/.codex/config.toml`
- Create transactionally: `C:/Users/asus/.codex/agents/DeepSeek.toml`
- Create transactionally: `C:/Users/asus/.codex/models-with-deepseek.json`
- Test: direct provider call, native child routing metadata, and `NATIVE_DEEPSEEK_OK`

**Interfaces:**
- Consumes: a credential supplied through standard input and an explicit `deepseek-v4-flash` or `deepseek-v4-pro` selection
- Produces: a verified native DeepSeek child role after restarting Codex Desktop and opening a new task

- [ ] **Step 1: Run setup with `--api-key-stdin` so the secret enters Windows Credential Manager without appearing in arguments or files.**
- [ ] **Step 2: Inspect structured setup output for rollback, conflict, restart, or new-task requirements.**
- [ ] **Step 3: Restart Codex Desktop and open a new task when required.**
- [ ] **Step 4: Verify provider, model, reasoning effort, agent role, child return marker, and database routing metadata.**
