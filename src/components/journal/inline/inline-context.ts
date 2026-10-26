"use client";
import { createContext } from "react";
import type { InlineEditing } from "@/hooks/use-inline-editing";
export const InlineEditContext = createContext<InlineEditing | null>(null);
