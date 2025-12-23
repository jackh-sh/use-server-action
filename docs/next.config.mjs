import nextra from "nextra";

const withNextra = nextra({
    latex: true,
    search: {
        codeblocks: false,
    },
});

export default withNextra({
    output: "standalone", // important for cloudflare
    reactStrictMode: true,
});
