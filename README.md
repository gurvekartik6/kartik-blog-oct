# Kartik Yadav Gurve — Personal Blogging Platform

## Deployment configuration

Set these variables in the hosting dashboards rather than committing `.env`:

- Web (Vercel): `VITE_API_URL=https://kartik-blog-oct.onrender.com`
- API (Render): `CLIENT_URL=https://kartik-gurve.vercel.app` and `API_URL=https://kartik-blog-oct.onrender.com`
- API email: the free option is Gmail SMTP. Enable 2-Step Verification on Gmail, create an App Password, then set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in Render. Resend remains supported when using a verified domain.

For local development, run the API on port 4000 before opening the web app. A production build defaults to the deployed API URL when `VITE_API_URL` is omitted.


#Done