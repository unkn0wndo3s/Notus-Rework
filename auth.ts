import { getServerSession } from "next-auth/next";
import { authOptions } from "./src/lib/auth";

export const auth = () => getServerSession(authOptions);
