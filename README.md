# Kartik Yadav Gurve — Personal Blogging Platform

## Deployment configuration

Set these variables in the hosting dashboards rather than committing `.env`:

- Web (Vercel): `VITE_API_URL=https://kartik-blog-oct.onrender.com`
- API (Render): `CLIENT_URL=https://kartik-gurve.vercel.app` and `API_URL=https://kartik-blog-oct.onrender.com`
- API email: set `RESEND_API_KEY` and `EMAIL_FROM` to a sender on a domain verified in Resend. Gmail, Yahoo, and Outlook addresses cannot be used as `EMAIL_FROM`.

For local development, run the API on port 4000 before opening the web app. A production build defaults to the deployed API URL when `VITE_API_URL` is omitted.


#Done