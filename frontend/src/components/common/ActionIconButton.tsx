import React from "react";
import { IconButton, Tooltip, SvgIconTypeMap, CircularProgress } from "@mui/material";
import { OverridableComponent } from "@mui/material/OverridableComponent";

type ActionIconButtonProps = {
    tooltip?: string | undefined;
    color?: "primary" | "inherit" | "default" | "secondary" | "error" | "info" | "success" | "warning";
    disabled?: boolean;
    loading?: boolean;
    inputIcon: OverridableComponent<SvgIconTypeMap<{}, "svg">>;
    onClick: () => void;
};

const ActionIconButton: React.FC<ActionIconButtonProps> = ({
    tooltip = undefined,
    color = "default",
    disabled = false,
    loading = false,
    inputIcon: InputIcon,
    onClick,
}) => {
    return (
        <Tooltip title={tooltip}>
            <span>
                {/* Wrapping in `span` ensures disabled IconButton won't break layout */}
                <IconButton
                    color={color}
                    onClick={onClick}
                    disabled={disabled || loading}
                >
                    {(loading) ? <CircularProgress /> : <InputIcon />}
                </IconButton>
            </span>
        </Tooltip>
    );
};

export default ActionIconButton;