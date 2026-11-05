"use client";
import { useState, type InputHTMLAttributes } from "react";
import { formatDate } from "@/lib/journal/view-config";

/** Keep the raw text while typing; expand short years only on blur or save. */
export function PlayDateInput({
  value,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");
  return (
    <input
      {...props}
      type="text"
      value={focused ? text : formatDate(value)}
      onFocus={(event) => {
        setText(event.currentTarget.value);
        setFocused(true);
      }}
      onChange={(event) => {
        setText(event.target.value);
        onChange(event.target.value);
      }}
      onBlur={() => {
        setFocused(false);
        if (text !== formatDate(value)) onChange(formatDate(text));
      }}
    />
  );
}
