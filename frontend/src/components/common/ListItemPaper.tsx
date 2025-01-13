import { Paper } from "@mui/material"
import { styled } from "@mui/material/styles"

/**
 * Styled Paper component for list items.
 */
const ListItemPaper = styled(Paper)(({ theme }) => ({
    borderTop: `2px solid ${theme.palette.primary.light}`, // Adds a tasteful overline
}));

export default ListItemPaper;