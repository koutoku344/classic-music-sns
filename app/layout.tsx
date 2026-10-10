import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Sonolii",
  description: "クラシック演奏者のためのSNS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
