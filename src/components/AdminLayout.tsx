import { Outlet } from 'react-router';
import { Toast } from './Toast';

/** Standalone shell for /admin with zero storefront header or footer. */
export function AdminLayout() {
  return (
    <>
      <Outlet />
      <Toast />
    </>
  );
}

