import { Typography, TypographyProps } from "@mui/material"
import { styled } from "@mui/material/styles"

/**
 * Styled header component.
 */
const SubheaderTypography = styled(Typography)<TypographyProps>(({ }) => ({
    fontWeight: "normal",
    fontSize: "1.2rem", // Slightly larger for header emphasis
    textTransform: "none", // Makes the header text all caps
    letterSpacing: "0.05em", // Adds subtle spacing for elegance
}));

export default SubheaderTypography;