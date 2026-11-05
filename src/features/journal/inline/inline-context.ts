"use client";
import { createContext } from "react";
import type { InlineEditing } from "../use-inline-editing";
export const InlineEditContext = createContext<InlineEditing | null>(null);
