// import {Events, WML} from "@wailsio/runtime";
// import Project from './pages/Project.js';
import { createTheme, CssBaseline } from '@mui/material';
import { deepPurple, indigo } from '@mui/material/colors';
import { useState } from 'react';
// import RootLayout from './pages/RootLayout.js';
import { CloudSync, Settings } from "@mui/icons-material";
import SettingsSystemDaydreamIcon from '@mui/icons-material/SettingsSystemDaydream';
import { Outlet } from 'react-router';
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import { Navigation } from '@toolpad/core';
import { MANAGE_REMOTES, PREFERENCES, SYNC_FOLDERS } from './routes';

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
  // const [time, setTime] = useState<string>('Listening for Time event...');
  // useEffect(() => {
  //   Events.On('time', (timeValue: any) => {
  //     setTime(timeValue.data);
  //   });
  //   // Reload WML so it picks up the wml tags
  //   WML.Reload();
  // }, []);

  // Determine whether the user's system preference is for dark mode. Note this has no effect outside of
  // a browser, but can't hurt to include.
  // const prefersDarkMode = useMediaQuery('(prefers-color-scheme:dark)')
  // prefersDarkMode;
  // TODO expose this in a settings page.
  const [isDarkMode, _] = useState<boolean>(true);

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
          root: { minWidth: "120px", minHeight: "50px" }
        }
      }
    }
  });

  return (
    <ReactRouterAppProvider navigation={NAVIGATION} branding={BRANDING} theme={appTheme}>
      <CssBaseline />
      <Outlet />
    </ReactRouterAppProvider>
  )
}

export default App
