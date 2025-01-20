import { ChevronLeft, CloudSync, Settings } from "@mui/icons-material";
import { useTheme } from "@mui/material";
import { AppProvider, Navigation, Router } from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
// import { PageContainer } from '@toolpad/core/PageContainer';
import { useMemo, useState } from "react";

const NAVIGATION: Navigation = [
    {
        kind: 'header',
        title: 'Project',
    },
    {
        segment: 'folders',
        title: 'Folders',
        icon: <ChevronLeft />,
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
        icon: <CloudSync />,
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
                {children}
            </DashboardLayout>
        </AppProvider>
    )
}

export default RootLayout;