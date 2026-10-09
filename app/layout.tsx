import "./globals.css";

export const metadata = {
  title: "Sonolii",
  description: "クラシック演奏者のためのSNS",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
