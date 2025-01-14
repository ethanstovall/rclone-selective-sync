import { Box, Paper, styled, Tab, Tabs, Typography, useTheme } from "@mui/material";
import { RcloneActionOutput } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend"
import { useState } from "react";
import Container50vh from "../common/Container50vh";

interface StyledTabProps {
    label: string;
    error: boolean;
}

const StyledTab = styled((props: StyledTabProps) => (
    <Tab {...props} />
))(({ theme, error }) => ({
    textTransform: 'none',
    fontWeight: theme.typography.fontWeightRegular,
    fontSize: theme.typography.pxToRem(15),
    minWidth: "15%",
    // backgroundColor: (error) ? theme.palette.error.light : "default",
    // Adding box shadow if there's an error
    boxShadow: error ? `inset 0 0 10px ${theme.palette.error.main}` : 'none',
    '&.Mui-selected': {
        color: error ? theme.palette.error.light : 'default', // Text turns error red when active
    },
    '&.MuiTab-root': {
        // Override underline color to dark error red
        '&.Mui-selected': {
            borderBottom: `2px solid ${error ? theme.palette.error.dark : 'transparent'}`,
        },
    },
    //     marginRight: theme.spacing(1),
    //     '&.Mui-selected': {
    //         color: '#fff',
    //     },
    //     '&.Mui-focusVisible': {
    //         backgroundColor: 'rgba(100, 95, 228, 0.32)',
    //     },
}));

interface TabPanelProps {
    children: React.ReactNode;
    value: number;
    index: number;
    error: boolean;  // Error flag passed to TabPanel
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, error, ...other } = props;
    const theme = useTheme();  // Access the theme here
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
            {...other}
            style={{
                whiteSpace: "pre-wrap", // Preserve newlines
                wordWrap: "break-word", // Ensure long lines wrap
                overflow: "auto", // Allow scrolling
                boxShadow: error ? `inset 0 0px 10px ${theme.palette.error.main}` : 'none', // Add box shadow for error
                height: "100%"
                // padding: "16px", // Optional: Adjust padding for content
                // maxHeight: "50vh", // Optional: Limit max height for scrolling
            }}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    <Typography>{children}</Typography>
                </Box>
            )}
        </div>
    );
}

function a11yProps(index) {
    return {
        id: `tab-${index}`,
        "aria-controls": `tabpanel-${index}`,
    };
}

interface RcloneActionOutputTabsProps {
    rcloneActionOuputs: RcloneActionOutput[];
    isAnyError: boolean;

}

const RcloneActionOutputTabs: React.FunctionComponent<RcloneActionOutputTabsProps> = ({
    rcloneActionOuputs,
    isAnyError,
}) => {
    const [tabValue, setTabValue] = useState<number>(0);
    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    return (
        <Container50vh component={Paper}>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    aria-label="Rclone folder tabs"
                    centered
                >
                    {rcloneActionOuputs.map((output, index) => (
                        <StyledTab
                            key={output.target_folder}
                            label={output.target_folder}
                            error={output.command_error.length > 0}
                            {...a11yProps(index)}
                        />
                    ))}
                </Tabs>
            </Box>
            {rcloneActionOuputs.map((output, index) => (
                <TabPanel key={output.target_folder} value={tabValue} index={index} error={output.command_error.length > 0}>
                    {output.command_error || output.command_output || "No output available"}
                </TabPanel>
            ))}
        </Container50vh>
    )
}

export default RcloneActionOutputTabs;