import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OwnYou Admin Dashboard',
  description: 'Development tool for IAB classifier and mission agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    OwnYou Admin Dashboard
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Phase 1.5 - Development Tool for IAB Classifier & Mission Agents
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    TypeScript Migration
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <p className="text-sm text-gray-500 text-center">
                OwnYou Admin Dashboard v0.1.0 - Week 1/4 of Phase 1.5
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
