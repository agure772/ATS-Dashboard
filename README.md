# ATS — Admin Truck Solutions Dashboard

## How to start (Windows)

1. Double-click **START.bat**
2. Wait for it to say "ATS Dashboard running"
3. Open your browser and go to: **http://localhost:3001**

That's it!

---

## Your GHL credentials are already set in the .env file

If you ever need to update them, open the `.env` file with Notepad and edit:
- `GHL_API_KEY` — your GoHighLevel API key
- `GHL_LOCATION_ID` — your location ID (SS9SXQU94ZExykvAta0y)

---

## Folder structure

```
ats-dashboard/
  START.bat          ← Double-click this to run
  .env               ← Your GHL credentials (already filled in)
  api/
    server.js        ← Backend server
  public/
    index.html       ← Dashboard UI
    css/
    js/
```
