# MiniApp (Student)
## Quick Start
1. Install deps:
```bash
cd miniapp
npm install --legacy-peer-deps
```
2. Run H5 preview:
```bash
npm run dev:h5 -- --host 0.0.0.0 --port 5173
```
3. Build WeChat Mini Program:
```bash
npm run build:mp-weixin
```
## WSL + Windows WeChat DevTools
1. Start H5 in WSL with `--host 0.0.0.0`.
2. In Windows browser, open the WSL IP URL shown in terminal (`http://<wsl-ip>:5173` or fallback port).
3. Build mini-program and import in WeChat DevTools using:
`\\wsl$\Ubuntu\home\zcy28\workspace\ai-homework-system\miniapp\dist\build\mp-weixin`
4. If your distro name is not `Ubuntu`, replace it with `wsl -l -v` output.
## Environment
Set API base URL via env:
```bash
VITE_API_BASE_URL=https://your-domain/api/v1
VITE_API_BASE_URL_MOBILE=https://your-mobile-domain/api/v1
```
Notes:
1. DevTools default fallback: `http://localhost:3000/api/v1`.
2. Real device will not be able to access `localhost`; configure `VITE_API_BASE_URL_MOBILE` to a reachable HTTPS domain or LAN IP.
## Current Scope
1. Student login
2. Course list
3. Assignment list
4. Assignment submit (text + structured answers + image upload)
5. Score list and detail
