
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/components/theme-provider';
import { AuthenticationProvider } from '@/context/authentication-provider';
import { RolesProvider } from '@/lib/roles-provider';
import { DebugLogProvider } from '@/context/debug-log-provider';
import { FontProvider } from '@/context/font-provider';

export const metadata: Metadata = {
  title: 'ProcureEase',
  description: 'A modern procurement portal by Ubuntu Education Fund',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Poppins:wght@400;500;600;700;800;900&family=Source+Sans+Pro:wght@400;600;700;900&family=Roboto:wght@400;500;700;900&family=Lato:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          themes={['light', 'dark', 'classic', 'colorful', 'glass', 'system']}
        >
          <AuthenticationProvider>
            <DebugLogProvider>
              <RolesProvider>
                <FontProvider>
                  {children}
                </FontProvider>
              </RolesProvider>
            </DebugLogProvider>
          </AuthenticationProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
