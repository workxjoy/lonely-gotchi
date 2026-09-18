"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin client: talks to /api/auth on this app.
export const authClient = createAuthClient();
