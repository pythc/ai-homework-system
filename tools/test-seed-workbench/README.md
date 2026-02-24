# Test Seed Workbench (Standalone Tool)

Standalone local GUI tool for generating test data for this project:
- bulk import courses (teacher + students)
- create/publish assignments
- randomly select students to submit assignments in batch

This tool is isolated in `tools/test-seed-workbench/` and does not modify the formal frontend/backend code paths.

## Prerequisites

1. Backend server is running (default API: `http://127.0.0.1:3000/api/v1`)
2. You have a valid admin account
3. `server` dependencies are installed (the tool reuses `server/node_modules/exceljs`)

## Start

From repo root:

```powershell
node tools/test-seed-workbench/server.js
```

Or double-click:

- `tools/test-seed-workbench/start.bat`

Then open:

```text
http://127.0.0.1:3789
```

## Notes

- Imported teachers/students default password is `123456` (backend bulk import behavior)
- The tool submits text-only answers (no images) using `SHORT_ANSWER` questions
- Names/course titles/assignment titles/submission content are auto-generated for testing
