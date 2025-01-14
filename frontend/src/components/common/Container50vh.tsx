import { Container, ContainerProps } from "@mui/material";
import { styled } from "@mui/material/styles";

/**
 * A container with a minimum height of 50vh, no max width, and support for dynamic components.
 */
const Container50vh = styled(Container)<ContainerProps>(({ theme }) => ({
    minHeight: "50vh",
    width: "100%", // Ensure it spans the full width if needed,
}));

export default Container50vh;