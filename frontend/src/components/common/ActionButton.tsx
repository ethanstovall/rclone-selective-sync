import React from "react";
import { Tooltip, CircularProgress, Button } from "@mui/material";

type ActionButtonProps = {
    tooltip?: string | undefined;
    color?: "primary" | "inherit" | "secondary" | "error" | "info" | "success" | "warning";
    variant?: "contained" | "outlined" | "text"
    autofocus?: boolean;
    disabled?: boolean;
    loading?: boolean;
    text: string;
    onClick: () => void;
};

const ActionButton: React.FunctionComponent<ActionButtonProps> = ({
    tooltip = undefined,
    color = "primary",
    variant = "contained",
    autofocus = false,
    disabled = false,
    loading = false,
    text,
    onClick,
}) => {
    return (
        <Tooltip title={tooltip}>
            <Button
                variant={variant}
                color={color}
                onClick={onClick}
                disabled={disabled || loading}
                autoFocus={autofocus}
            >
                {(loading) ? <CircularProgress /> : text}
            </Button>
        </Tooltip>
    );
};

export default ActionButton;