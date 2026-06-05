// Generate a VAPID keypair for Web Push notifications.
// Run:  npm run generate:vapid
// Paste the output into .env.local.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("\nAdd these to .env.local (and your Vercel env):\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log("VAPID_SUBJECT=mailto:notifications@yourdomain.com\n");
