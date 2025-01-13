import { Typography } from "@mui/material"
import { styled } from "@mui/material/styles"

/**
 * Styled header component.
 */
const StandardTypography = styled(Typography)(({ theme }) => ({
    fontWeight: "normal",
    fontSize: "1.2rem", // Slightly larger for header emphasis
    color: theme.palette.secondary.main, // Matches the primary color from the theme
    textTransform: "none", // Makes the header text all caps
    letterSpacing: "0.05em", // Adds subtle spacing for elegance
}));

export default StandardTypography;