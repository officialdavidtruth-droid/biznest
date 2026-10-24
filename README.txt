BizNest sidebar + dashboard animation update

Copy these files into the ROOT of your BizNest project, preserving folders:
- app/globals.css
- components/dashboard/sidebar.tsx
- components/dashboard/adaptive-dashboard-home.tsx

Back up your existing files first. This update adds sidebar entrance/hover/submenu animations and retains the dashboard entrance/chart/card animation CSS.

After copying:
1. Restart the dev server (stop it and run npm run dev again).
2. Hard refresh the browser (Ctrl+Shift+R).
3. Check npm run build before deploying.

Note: The project build was not run in this environment because dependencies are not installed here.
