import { auth } from "@/lib/auth";
import { toNodeHandler } from "better-auth/node";

export const { GET, POST } = toNodeHandler(auth);
