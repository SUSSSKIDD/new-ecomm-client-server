# DNS Setup Instructions

Based on your Hostinger dashboard screenshots, here is exactly how to link **neyokart.in** and **neyokart.com** to your new deployment:

Your Hostinger VPS IP address appears to be **2.57.91.91** (from the `neyokart.in` screenshot).

## 1. For `neyokart.in`
Your DNS records are almost perfect. 

1. Ensure you have an **A-Record** pointing to your server:
   * **Type**: `A`
   * **Name**: `@`
   * **Points to**: `2.57.91.91`
2. You currently have a **CNAME** pointing to `neyokart.in`. This is completely fine and handles the `www.neyokart.in` subdomain correctly.

## 2. For `neyokart.com`
Currently, the screenshots show it is connected to Hostinger's default builder (`connect.hostinger.com`). You need to delete those and point them to your actual VPS.

1. **Delete** the existing `CNAME` for `www` and the `ALIAS` for `@` that point to `connect.hostinger.com`.
2. **Add an A-Record**:
   * **Type**: `A`
   * **Name**: `@`
   * **Points to**: `2.57.91.91` (Your VPS IP)
3. **Add a CNAME-Record** (Optional but recommended for `www`):
   * **Type**: `CNAME`
   * **Name**: `www`
   * **Points to**: `neyokart.com`

---
Once you make these changes on Hostinger, the DNS will propagate. When users hit either `.com` or `.in`, they will arrive at your VPS on Port 80, and the Nginx config I just updated will catch them and securely route them cleanly into the Blue/Green Docker containers!
