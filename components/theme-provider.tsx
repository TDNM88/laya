"use client"

import type React from "react"

import { createContext, useContext, useEffect } from "react"
import { useChatStore } from "@/lib/chat-store"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
}

const ThemeProviderContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | undefined>(undefined)

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme, setTheme } = useChatStore()

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  const value = {
    theme,
    setTheme,
  }

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
