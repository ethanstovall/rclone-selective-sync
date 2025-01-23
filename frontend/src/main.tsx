import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import RootLayout from './pages/RootLayout';
import SyncFolders from './pages/SyncFolders';
import { MANAGE_REMOTES, PREFERENCES, SYNC_FOLDERS } from './routes';
import Preferences from './pages/Preferences';
import ManageRemotes from './pages/ManageRemotes';

// Created following the MUI Toolpad tutorial at https://mui.com/toolpad/core/integrations/react-router/
const router = createBrowserRouter([
  {
    Component: App,
    children: [
      {
        path: '',
        Component: RootLayout,
        children: [
          {
            path: '/',
            element: <Navigate to={SYNC_FOLDERS} />
          },
          {
            path: SYNC_FOLDERS,
            Component: SyncFolders,
          },
          {
            path: PREFERENCES,
            Component: Preferences,
          },
          {
            path: MANAGE_REMOTES,
            Component: ManageRemotes,
          },
        ],
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
