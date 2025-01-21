import { CloudSync, Settings } from "@mui/icons-material";
import SettingsSystemDaydreamIcon from '@mui/icons-material/SettingsSystemDaydream';
import { useTheme } from "@mui/material";
import { AppProvider, Navigation, Router } from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
// import { PageContainer } from '@toolpad/core/PageContainer';
import { useMemo, useState } from "react";
import PaddedBox from "../components/common/PaddedBox";

const NAVIGATION: Navigation = [
    {
        kind: 'header',
        title: 'Project',
    },
    {
        segment: 'folders',
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
        segment: 'preferences',
        title: 'Preferences',
        icon: <Settings />,
    },
    {
        segment: 'remotes',
        title: 'Remotes',
        icon: <SettingsSystemDaydreamIcon />,
    },
];

function useAppRouter(initialPath: string): Router {
    const [pathname, setPathname] = useState(initialPath);

    const router = useMemo(() => {
        return {
            pathname,
            searchParams: new URLSearchParams(),
            navigate: (path: string | URL) => setPathname(String(path)),
        };
    }, [pathname]);

    return router;
}

interface RootLayoutProps {
    children: React.ReactNode;
}

const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
    const router = useAppRouter('/');
    const theme = useTheme();

    return (
        <AppProvider
            branding={{
                title: "Rclone Selective Sync",
                logo: false,
            }}
            navigation={NAVIGATION}
            router={router}
            theme={theme}
            window={window}
        >
            <DashboardLayout>
                <PaddedBox>
                    {children}
                </PaddedBox>
            </DashboardLayout>
        </AppProvider>
    )
}

export default RootLayout;