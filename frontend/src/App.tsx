import { createTheme, CssBaseline, useMediaQuery } from '@mui/material';
import { deepPurple, indigo } from '@mui/material/colors';
import { useState } from 'react';
import { CloudSync, Settings } from "@mui/icons-material";
import SettingsSystemDaydreamIcon from '@mui/icons-material/SettingsSystemDaydream';
import { Outlet } from 'react-router';
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import { Navigation } from '@toolpad/core';
import { MANAGE_REMOTES, PREFERENCES, SYNC_FOLDERS } from './routes';
import { GlobalConfigContextProvider } from './hooks/GlobalConfigContext';
import { ProjectConfigContextProvider } from './hooks/ProjectConfigContext';
import { TaskQueueContextProvider } from './hooks/TaskQueueContext';

const NAVIGATION: Navigation = [
  {
    kind: 'header',
    title: 'Project',
  },
  {
    segment: SYNC_FOLDERS,
    title: 'Sync Folders',
    icon: <CloudSync />,
  },
  {
    kind: 'divider',
  },
  {
    kind: 'header',
    title: 'Settings',
  },
  {
    segment: PREFERENCES,
    title: 'Preferences',
    icon: <Settings />,
  },
  {
    segment: MANAGE_REMOTES,
    title: 'Remotes',
    icon: <SettingsSystemDaydreamIcon />,
  },
];

const BRANDING = {
  title: "Rclone Selective Sync",
  logo: false,
}


function App() {

  // Determine whether the user's system preference is for dark mode. Note this has no effect outside of
  // a browser, but can't hurt to include.
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme:dark)')
  // TODO expose this in a settings page.
  const [isDarkMode, _] = useState<boolean>(prefersDarkMode);

  const appTheme = createTheme({
    palette: {
      mode: (isDarkMode) ? "dark" : "light",
      primary: {
        main: indigo[500],
        dark: indigo[700],
      },
      secondary: {
        main: deepPurple[200],
        dark: deepPurple[400],
      },
    },
    // Override because buttons don't seem to grow to accommodate text
    components: {
      MuiButton: {
        styleOverrides: {
          root: { minWidth: "150px", minHeight: "50px" }
        }
      }
    }
  });

  return (
    <ReactRouterAppProvider navigation={NAVIGATION} branding={BRANDING} theme={appTheme}>
      <CssBaseline enableColorScheme />
      <GlobalConfigContextProvider>
        <ProjectConfigContextProvider>
          <TaskQueueContextProvider>
            <Outlet />
          </TaskQueueContextProvider>
        </ProjectConfigContextProvider>
      </GlobalConfigContextProvider>
    </ReactRouterAppProvider>
  )
}

export default App
