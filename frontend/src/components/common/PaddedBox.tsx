import { Box } from "@mui/material"
import { styled } from "@mui/material/styles"

/**
 * A default padded box.
 */
const PaddedBox = styled(Box)(({ theme }) => ({
    padding: '10px',
}));

export default PaddedBox;