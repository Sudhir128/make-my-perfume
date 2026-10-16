import { createBrowserRouter } from 'react-router';
import { Layout } from '../components/Layout';
import { PageLoading } from '../components/PageLoading';
import NotFound from '../pages/NotFound';

// Pages load on demand with their data loaders. Loaders call the repository,
// so swapping it for a backend later does not touch the routes.
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    HydrateFallback: PageLoading,
    children: [
      {
        index: true,
        lazy: () => import('../pages/Home').then((m) => ({ Component: m.default, loader: m.loader })),
      },
      { path: 'collection', lazy: () => import('../pages/Collection').then((m) => ({ Component: m.default, loader: m.loader })) },
      { path: 'product/:slug', lazy: () => import('../pages/Product').then((m) => ({ Component: m.default, loader: m.loader })) },
      { path: 'bag', lazy: () => import('../pages/Bag').then((m) => ({ Component: m.default })) },
      { path: 'profile', lazy: () => import('../pages/Profile').then((m) => ({ Component: m.default })) },
      // Unlinked specimen page for visual review.
      { path: 'foundation', lazy: () => import('../pages/Foundation').then((m) => ({ Component: m.default })) },
      { path: '*', Component: NotFound },
    ],
  },
]);
