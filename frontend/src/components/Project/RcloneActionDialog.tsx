import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { RcloneAction, RcloneActionOutput } from '../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend';
import { LinearProgress } from '@mui/material';
import ActionButton from '../common/ActionButton';

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
                    (rcloneDryOutput !== null) ? (
                        <DialogContentText
                            id="rclone-command-dialog-description"
                            ref={descriptionElementRef}
                            tabIndex={-1}
                        >
                            {
                                rcloneDryOutput.map(
                                    (output) => output.command_output
                                ).join('\n')}
                        </DialogContentText>
                    ) : (
                        <LinearProgress />
                    )
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
                    disabled={isRunningRcloneAction}
                    onClick={runRcloneCommand}
                    text="Confirm"
                    autofocus
                />
            </DialogActions>
        </Dialog>
    );
}

export default RcloneActionDialog;