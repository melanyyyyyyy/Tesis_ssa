import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogContentText, 
    DialogActions, 
    Button 
} from '@mui/material';

interface ModalDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'info' | 'warning' | 'error';
}

export const ModalDialog = ({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    variant = 'info'
}: ModalDialogProps) => {
    
    const getConfirmColor = () => {
        switch (variant) {
            case 'error': return 'error';
            case 'warning': return 'warning';
            default: return 'primary';
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            <DialogTitle id="alert-dialog-title">
                {title}
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    {description}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    {cancelText}
                </Button>
                <Button onClick={onConfirm} color={getConfirmColor()} autoFocus variant="contained">
                    {confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
