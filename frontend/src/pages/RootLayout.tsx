
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
// import { PageContainer } from '@toolpad/core/PageContainer';
import { ComponentType } from "react";
import PaddedBox from "../components/common/PaddedBox";
import { Outlet } from "react-router";


const RootLayout: ComponentType<{}> = () => {
    return (
        <DashboardLayout>
            <PaddedBox>
                <Outlet />
            </PaddedBox>
        </DashboardLayout>
    )
}

export default RootLayout;