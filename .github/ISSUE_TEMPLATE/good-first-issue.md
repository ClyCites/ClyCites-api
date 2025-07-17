---
name: "🆕 Good First Issue"
about: "This issue is for first-time contributors. Start here!"
title: "[First Timers Only] {{Short Description of the Issue}}"
labels: ["good first issue", "first timers only", "help wanted", "testing"]
assignees: ""
---

# 🐥 First Timers Only – Good First Issue

This issue is reserved for **new contributors** to this repository or anyone who is **new to open source** in general.  
We understand that making your **first pull request (PR)** can be overwhelming, and we're here to help!

The purpose of this issue—and others labeled with `good first issue`—is to guide you through your **first open-source contribution**.

---

## 👾 Issue Description

In the `{{module-name}}` module, the `{{ClassName}}` class lacks test coverage for the `{{methodName}}` method.  
This method performs {{brief-description-of-what-it-does}}, but currently has **no unit tests or integration tests** to validate its behavior.

Please test for:
- ✅ Valid input
- ❌ Invalid or missing input
- 🚨 Exception handling (e.g., `{{CustomException}}`)

---

## ✅ Suggested Solution

Create or extend the appropriate test class (e.g., `{{ClassName}}Test`) to add full coverage for the `{{methodName}}` method.

Follow existing testing patterns (likely using **JUnit** or the relevant test framework).  
Ensure to include **positive and negative** test cases.

---

## 📋 Step-by-Step Guide to Contribute

1. **Comment below** to claim this issue.

2. Wait for a **maintainer to assign** it to you.

3. **Fork** the repo, then **clone** your fork locally.

4. Create a new branch:

  ```bash
    git checkout -b issue-{{issueNumber}}-add-tests
  ```

### 🛠️ Implement the Fix

- Add or update the necessary tests in the codebase.

- Ensure your tests cover all edge cases and scenarios mentioned in the issue description.

- Commit your changes with a clear message:

  ```bash
    git commit -s -m "test: add coverage for {{methodName}} in {{ClassName}}"
  ```
- Ensure your commit is signed off with `-s` to comply with the Developer Certificate of Origin.

- Push your branch to your forked repository:

  ```bash
    git push origin issue-{{issueNumber}}-add-tests
  ```

- Open a **Pull Request (PR)** to the main repository.

- Monitor **GitHub Actions** – if any checks fail and you're unsure why, feel free to ask for help in the PR comments.

- Respond to feedback and make any necessary changes requested during the code review.

- Once approved, your PR will be merged by a maintainer.

- Celebrate your first contribution to open source! 🎉
