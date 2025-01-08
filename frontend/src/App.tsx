// import {Events, WML} from "@wailsio/runtime";
import Home from './pages/Home.js';
import { GlobalConfigContextProvider } from './hooks/GlobalConfigContext.js';

function App() {
  // const [time, setTime] = useState<string>('Listening for Time event...');
  // useEffect(() => {
  //   Events.On('time', (timeValue: any) => {
  //     setTime(timeValue.data);
  //   });
  //   // Reload WML so it picks up the wml tags
  //   WML.Reload();
  // }, []);
  return (
    <GlobalConfigContextProvider>
      <Home />
    </GlobalConfigContextProvider>

  )
}

export default App
