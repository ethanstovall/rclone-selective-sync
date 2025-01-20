// import {Events, WML} from "@wailsio/runtime";
import Project from './pages/Project.js';
import { GlobalConfigContextProvider } from './hooks/GlobalConfigContext.js';
import { Container, createTheme, CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { deepPurple, indigo } from '@mui/material/colors';
import { useState } from 'react';

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
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme:dark)')
  prefersDarkMode;
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
    <ThemeProvider theme={appTheme}>
      <GlobalConfigContextProvider>
        <CssBaseline />
        <Container maxWidth={false} style={{ height: "100vh", width: "100vw", overflow: "auto" }}>
          <Project />
        </Container>
      </GlobalConfigContextProvider>
    </ThemeProvider>
  )
}

export default App
