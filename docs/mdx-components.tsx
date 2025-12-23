import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

// Infer the components map type from the theme itself
type ThemeComponents = ReturnType<typeof getThemeComponents>;

const themeComponents = getThemeComponents();

export function useMDXComponents(
    components: Partial<ThemeComponents> = {},
): ThemeComponents {
    return {
        ...themeComponents,
        ...components,
    };
}
