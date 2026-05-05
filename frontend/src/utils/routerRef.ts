// Module-level reference to the createBrowserRouter instance, so non-React code
// (например, WS-обработчики в wsClient) могло выполнить client-side navigation
// без полной перезагрузки страницы.
import type { createBrowserRouter } from 'react-router-dom';

type AppRouter = ReturnType<typeof createBrowserRouter>;

let _router: AppRouter | null = null;

export function setAppRouter(router: AppRouter) {
  _router = router;
}

export function navigateTo(path: string, options?: { replace?: boolean }) {
  if (_router) {
    _router.navigate(path, options);
    return;
  }
  if (typeof window !== 'undefined') {
    if (options?.replace) window.location.replace(path);
    else window.location.assign(path);
  }
}
