import { z } from "zod";
import { statuses, type Status } from "../types";

// Older installed clients and saved records can still send the retired value.
export const statusSchema = z.preprocess(
  (value) => (value === "backlog" ? "wishlist" : value),
  z.enum(Object.keys(statuses) as [Status, ...Status[]]),
);
