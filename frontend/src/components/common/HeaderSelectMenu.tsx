import { styled } from '@mui/material/styles';
import Select from '@mui/material/Select';

const HeaderSelectMenu = styled(Select)(({ theme }) => ({
    '& .MuiOutlinedInput-notchedOutline': {
        border: 'none', // Remove the border
    },
    '& .MuiSelect-icon': {
        color: theme.palette.primary.main, // Use the theme's primary color for the arrow
        fontSize: '2rem', // Adjust the arrow size
    },
    '&:hover .MuiSelect-icon': {
        color: theme.palette.primary.dark, // Darker shade on hover
    },
    '& .MuiSelect-select': {
        padding: '8px 12px', // Adjust padding for better alignment
    },
}));

export default HeaderSelectMenu;