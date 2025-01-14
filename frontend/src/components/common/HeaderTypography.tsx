import { Typography } from "@mui/material"
import { styled } from "@mui/material/styles"

/**
 * Styled header component.
 */
const HeaderTypography = styled(Typography)(({ theme }) => ({
    fontWeight: "bold",
    fontSize: "1.8rem", // Slightly larger for header emphasis
    color: theme.palette.primary.main, // Matches the primary color from the theme
    textTransform: "none", // Makes the header text all caps
    letterSpacing: "0.1em", // Adds subtle spacing for elegance
    // marginBottom: "16px", // Adds spacing below the header.
    borderBottom: `2px solid ${theme.palette.primary.main}`, // Adds a tasteful underline
    paddingBottom: "4px", // Adds padding for the underline
}));

export default HeaderTypography;