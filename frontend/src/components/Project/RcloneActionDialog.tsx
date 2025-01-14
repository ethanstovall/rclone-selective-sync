import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { RcloneActionOutput } from '../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend';
import { Box, CircularProgress } from '@mui/material';

const RcloneActionDialog: React.FunctionComponent<{
    rcloneDryOutput: RcloneActionOutput[] | null;
    isOpen: boolean;
    runRcloneCommand: () => void;
    handleClose: () => void;
}> = ({ rcloneDryOutput, isOpen, handleClose, runRcloneCommand }) => {

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
        <React.Fragment>
            <Dialog
                open={isOpen}
                onClose={handleClose}
                scroll={"paper"}
                maxWidth={false}
                fullWidth={true}
                aria-labelledby="rclone-command-dialog-title"
                aria-describedby="rclone-command-dialog-description"
            >
                <DialogTitle id="rclone-command-dialog-title">Finalize Rclone Action?</DialogTitle>
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
                            <CircularProgress />
                        )
                    }

                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button onClick={runRcloneCommand}>Confirm</Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    );
}

export default RcloneActionDialog;