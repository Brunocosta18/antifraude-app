import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Raiz HTML da web (somente SSR/web). Metadados de PWA: sem Service Worker,
// sem analytics e sem scripts externos (LGPD).
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#208AEF" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Antigolpe" />
        <meta name="mobile-web-app-capable" content="yes" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
