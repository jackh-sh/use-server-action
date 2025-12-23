import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Banner, Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata = {
    title: {
        default: "use-server-action",
        template: "%s - use-server-action",
    },
    description:
        "A type-safe React hook and utilities for Next.js server actions",
};

const banner = (
    <Banner storageKey="some-key">use-server-action 1.0 is released 🎉</Banner>
);

const navbar = (
    <Navbar
        logo={<strong>use-server-action</strong>}
        projectLink="https://github.com/your-username/use-server-action"
    />
);

const footer = (
    <Footer>MIT {new Date().getFullYear()} © use-server-action</Footer>
);

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" dir="ltr" suppressHydrationWarning>
            <Head faviconGlyph="⚡" />
            <body>
                <Layout
                    banner={banner}
                    navbar={navbar}
                    footer={footer}
                    pageMap={await getPageMap()}
                    docsRepositoryBase="https://github.com/jackh-sh/use-server-action/tree/main/docs"
                >
                    {children}
                </Layout>
            </body>
        </html>
    );
}
