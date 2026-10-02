import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monitoreo de fuentes oficiales | Cámara de Comercio de Cali",
  description:
    "Ayudas y regulaciones relevantes para empresas tras el sismo del 10 de agosto de 2026.",
};

// Aplica el tema guardado antes de pintar la página (evita el parpadeo)
const themeScript = `
try {
  var t = localStorage.getItem("ccc-sismo:tema");
  document.documentElement.dataset.theme = t === "dark" ? "dark" : "light";
} catch (e) {
  document.documentElement.dataset.theme = "light";
}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}