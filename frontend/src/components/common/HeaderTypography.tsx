import { Typography, TypographyProps } from "@mui/material"
import { styled } from "@mui/material/styles"

/**
 * Styled header component.
 */
const HeaderTypography = styled(Typography, {
    shouldForwardProp: (prop) => prop !== "color",
})<TypographyProps & { color?: "primary" | "secondary" | "error" | "info" | "success" | "warning" }>(({ theme, color }) => ({
    fontWeight: "bold",
    fontSize: "1.8rem", // Slightly larger for header emphasis
    textTransform: "none", // Keeps the header text case as provided
    letterSpacing: "0.1em", // Adds subtle spacing for elegance
    color: color && theme.palette[color].main,
    borderBottom: `2px solid ${color && theme.palette[color] ? theme.palette[color].main : theme.palette.primary.main
        }`, // Match the theme palette color or fallback to primary
    paddingBottom: "4px", // Adds padding for the underline
}));

export default HeaderTypography;