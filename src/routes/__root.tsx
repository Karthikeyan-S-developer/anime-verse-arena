import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl sm:text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-lg sm:text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AnimeVerse — Real-Time Anime Battle Arena" },
      { name: "description", content: "Two-player real-time anime trivia. Quiz battles, character guessing, rapid fire — choose your weapon." },
      { name: "author", content: "AnimeVerse" },
      { property: "og:title", content: "AnimeVerse — Real-Time Anime Battle Arena" },
      { property: "og:description", content: "Two-player real-time anime trivia. Quiz battles, character guessing, rapid fire — choose your weapon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "AnimeVerse — Real-Time Anime Battle Arena" },
      { name: "twitter:description", content: "Two-player real-time anime trivia. Quiz battles, character guessing, rapid fire — choose your weapon." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/fqWzDN52h6RXMkexwn4rVJwHp7E3/social-images/social-1777697400466-wmremove-transformed.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/fqWzDN52h6RXMkexwn4rVJwHp7E3/social-images/social-1777697400466-wmremove-transformed.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
