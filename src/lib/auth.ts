import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  // In a real application, you'd wire up a custom MongoDB adapter here
  // tailored to the User and Company mongoose models we just created.
});
