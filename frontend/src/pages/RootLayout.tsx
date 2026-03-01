
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import { ComponentType } from "react";
import PaddedBox from "../components/common/PaddedBox";
import { Outlet } from "react-router";
import TaskPanel from "../components/TaskQueue/TaskPanel";

const RootLayout: ComponentType<{}> = () => {
    return (
        <DashboardLayout>
            <PaddedBox>
                <Outlet />
            </PaddedBox>
            <TaskPanel />
        </DashboardLayout>
    )
}

export default RootLayout;