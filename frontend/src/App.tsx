// import {Events, WML} from "@wailsio/runtime";
import Project from './pages/Project.js';
import { GlobalConfigContextProvider } from './hooks/GlobalConfigContext.js';
import { Container, createTheme, CssBaseline, Paper, ThemeProvider, useMediaQuery } from '@mui/material';
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
        main: indigo[700],
        dark: indigo[900],
      },
      secondary: {
        main: deepPurple[200],
        dark: deepPurple[400],
      },
    },
  });

  return (
    <ThemeProvider theme={appTheme}>
      <GlobalConfigContextProvider>
        <CssBaseline />
        <Container component={Paper} maxWidth={false} style={{ height: "100vh", width: "100vw", padding: 10 }}>
          <Project />
        </Container>
      </GlobalConfigContextProvider>
    </ThemeProvider>
  )
}

export default App
