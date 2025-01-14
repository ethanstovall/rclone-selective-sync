import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { RcloneAction, RcloneActionOutput } from '../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend';
import { LinearProgress } from '@mui/material';
import ActionButton from '../common/ActionButton';
import RcloneActionOutputTabs from './RcloneActionOutputTabs';
import Container50vh from '../common/Container50vh';
import { useMemo } from 'react';

interface RcloneActionDialogProps {
    action: RcloneAction;
    rcloneDryOutput: RcloneActionOutput[] | null;
    isRunningRcloneAction: boolean;
    isOpen: boolean;
    runRcloneCommand: () => void;
    handleClose: () => void;
}

const RcloneActionDialog: React.FunctionComponent<RcloneActionDialogProps> = ({
    action,
    rcloneDryOutput,
    isRunningRcloneAction,
    isOpen,
    handleClose,
    runRcloneCommand,
}) => {
    // Determine if there were any errors. If so, the user cannot finalize the Rclone action.
    const isAnyError: boolean = useMemo(() => {
        return !rcloneDryOutput?.every((output) => (output.command_error.length === 0))
    }, [rcloneDryOutput])

    const descriptionElementRef = React.useRef<HTMLElement>(null);
    React.useEffect(() => {
        if (isOpen) {
            const { current: descriptionElement } = descriptionElementRef;
            if (descriptionElement !== null) {
                descriptionElement.focus();
            }
        }
    }, [open]);

    return (
        <Dialog
            open={isOpen}
            onClose={handleClose}
            scroll={"paper"}
            maxWidth={false}
            fullWidth={true}
            aria-labelledby="rclone-command-dialog-title"
            aria-describedby="rclone-command-dialog-description"
        >
            <DialogTitle id="rclone-command-dialog-title">{`Finalize Rclone ${action}?`}</DialogTitle>
            <DialogContent dividers>
                {
                    <Container50vh>
                        {(rcloneDryOutput !== null) ? (
                            <RcloneActionOutputTabs
                                rcloneActionOuputs={rcloneDryOutput}
                                isAnyError={isAnyError}
                            />
                        ) : (
                            <LinearProgress />
                        )}
                    </Container50vh>

                }

            </DialogContent>
            <DialogActions
                sx={{
                    padding: '16px', // Adjust padding around the actions
                    justifyContent: 'space-evenly', // Spread buttons if needed
                }}>
                <ActionButton
                    disabled={isRunningRcloneAction}
                    onClick={handleClose}
                    text="Cancel"
                    variant="text"
                />
                <ActionButton
                    loading={isRunningRcloneAction}
                    disabled={isAnyError}
                    onClick={runRcloneCommand}
                    text="Confirm"
                    autofocus
                />
            </DialogActions>
        </Dialog>
    );
}

export default RcloneActionDialog;