import React from "react";
import { Tooltip, CircularProgress, Button } from "@mui/material";

type ActionButtonProps = {
    tooltip?: string | undefined;
    color?: "primary" | "inherit" | "secondary" | "error" | "info" | "success" | "warning";
    variant?: "contained" | "outlined" | "text"
    autofocus?: boolean;
    disabled?: boolean;
    loading?: boolean;
    text?: string;
    textTransform?: string;
    endIcon?: React.ReactNode | null;
    size?: "small" | "medium" | "large";
    onClick: () => void;
};

const ActionButton: React.FunctionComponent<ActionButtonProps> = ({
    tooltip = undefined,
    color = "primary",
    variant = "contained",
    autofocus = false,
    disabled = false,
    loading = false,
    text = "",
    textTransform = "none",
    endIcon = null,
    size = "medium",
    onClick,
}) => {
    return (
        <Tooltip title={tooltip}>
            <span>
                <Button
                    variant={variant}
                    color={color}
                    onClick={onClick}
                    disabled={disabled || loading}
                    autoFocus={autofocus}
                    endIcon={endIcon}
                    size={size}
                    sx={{ textTransform: textTransform }}
                >
                    {(loading) ? <CircularProgress /> : text}
                </Button>
            </span>
        </Tooltip>
    );
};

export default ActionButton;