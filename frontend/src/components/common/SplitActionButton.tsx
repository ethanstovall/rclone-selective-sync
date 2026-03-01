import React, { useRef, useState } from "react";
import {
    ButtonGroup, CircularProgress, ClickAwayListener, Grow, IconButton,
    MenuItem, MenuList, Paper, Popper, SvgIconTypeMap, Tooltip,
} from "@mui/material";
import { ArrowDropDown } from "@mui/icons-material";
import { OverridableComponent } from "@mui/material/OverridableComponent";

interface SplitActionButtonProps {
    tooltip: string;
    directTooltip?: string;
    color?: "primary" | "inherit" | "default" | "secondary" | "error" | "info" | "success" | "warning";
    disabled?: boolean;
    loading?: boolean;
    inputIcon: OverridableComponent<SvgIconTypeMap<{}, "svg">>;
    onClickDefault: () => void;
    onClickDirect: () => void;
}

const SplitActionButton: React.FC<SplitActionButtonProps> = ({
    tooltip,
    directTooltip = "Run Directly (skip preview)",
    color = "primary",
    disabled = false,
    loading = false,
    inputIcon: InputIcon,
    onClickDefault,
    onClickDirect,
}) => {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLDivElement>(null);

    const handleToggle = () => {
        setOpen(prev => !prev);
    };

    const handleClose = (event: Event) => {
        if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
            return;
        }
        setOpen(false);
    };

    const handleDirectClick = () => {
        setOpen(false);
        onClickDirect();
    };

    return (
        <>
            <ButtonGroup
                ref={anchorRef}
                variant="text"
                disabled={disabled || loading}
            >
                <Tooltip title={tooltip}>
                    <span>
                        <IconButton
                            color={color}
                            onClick={onClickDefault}
                            disabled={disabled || loading}
                        >
                            {loading ? <CircularProgress size={24} /> : <InputIcon />}
                        </IconButton>
                    </span>
                </Tooltip>
                <IconButton
                    size="small"
                    color={color}
                    onClick={handleToggle}
                    disabled={disabled || loading}
                    sx={{ px: 0, minWidth: "auto" }}
                >
                    <ArrowDropDown fontSize="small" />
                </IconButton>
            </ButtonGroup>
            <Popper
                open={open}
                anchorEl={anchorRef.current}
                role={undefined}
                transition
                disablePortal
                sx={{ zIndex: 1400 }}
            >
                {({ TransitionProps, placement }) => (
                    <Grow
                        {...TransitionProps}
                        style={{ transformOrigin: placement === "bottom" ? "center top" : "center bottom" }}
                    >
                        <Paper elevation={4}>
                            <ClickAwayListener onClickAway={handleClose}>
                                <MenuList autoFocusItem dense>
                                    <MenuItem onClick={handleDirectClick}>
                                        {directTooltip}
                                    </MenuItem>
                                </MenuList>
                            </ClickAwayListener>
                        </Paper>
                    </Grow>
                )}
            </Popper>
        </>
    );
};

export default SplitActionButton;
