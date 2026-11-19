import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "بوصلة | BOSLA AI — التخطيط الاستراتيجي والتشغيلي",
  description: "بوصلة AI منصة مستقلة لورش التخطيط الاستراتيجي والتشغيلي وتحليل البيئة المؤسسية",
};
export default function RootLayout({children}:{children:ReactNode}) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
