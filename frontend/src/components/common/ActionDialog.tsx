import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import ActionButton from '../common/ActionButton';

interface ActionDialogProps {
    title: string;
    isLoading: boolean;
    isDisabled: boolean;
    isOpen: boolean;
    handleConfirm: () => void;
    handleClose: (event, reason) => void;
    children: React.ReactNode;
}

const ActionDialog: React.FunctionComponent<ActionDialogProps> = ({
    title,
    isLoading,
    isDisabled,
    isOpen,
    handleConfirm,
    handleClose,
    children,
}) => {

    return (
        <Dialog
            open={isOpen}
            onClose={handleClose}
            scroll={"paper"}
            maxWidth={false}
            fullWidth={true}
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description"
        >
            <DialogTitle id="dialog-title">{title}</DialogTitle>
            <DialogContent dividers>
                {children}
            </DialogContent>
            <DialogActions
                sx={{
                    padding: '16px', // Adjust padding around the actions
                    justifyContent: 'space-evenly', // Spread buttons if needed
                }}>
                <ActionButton
                    disabled={isDisabled}
                    // Just feed the handleClose a null for the event and reason here since they won't be used.
                    onClick={() => { handleClose(null, null) }}
                    text="Cancel"
                    variant="text"
                />
                <ActionButton
                    loading={isLoading}
                    disabled={isDisabled}
                    onClick={handleConfirm}
                    text="Confirm"
                    autofocus
                />
            </DialogActions>
        </Dialog>
    );
}

export default ActionDialog;