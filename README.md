# MITAOE SmartAttend — QR + Geolocation Attendance

A college-personalized educational prototype inspired by the public TrackAS repository. It is an independent implementation, not an official MITAOE system.

## Features
- Student, teacher and admin demo roles.
- Teacher creates a course QR session (5-minute expiry).
- Student opens/scans the QR link, grants location access and checks in.
- Haversine distance validation against a configurable campus point/radius.
- Duplicate check-in prevention; teacher closes a session and remaining students are recorded absent.
- Course-wise attendance percentage, low-attendance notifications to student and teacher, and CSV export.
- Student recovery planner calculates how many consecutive upcoming lectures must be attended to reach the threshold.
- Admin can change the threshold.

## Requirements
Node.js 18+ and npm. Internet is needed once to install npm packages.

## Run locally (Windows PowerShell)
1. Extract the ZIP.
2. Open PowerShell in the `MITAOE_SmartAttend` folder.
3. Run:
   ```powershell
   npm install
   npm start
   ```
4. Open http://localhost:3000

Demo accounts:
| Role | Email | Password |
|---|---|---|
| Student | aarav@mit.edu | student123 |
| Student | ananya@mit.edu | student123 |
| Teacher | teacher@mit.edu | teacher123 |
| Admin | admin@mit.edu | admin123 |

## Test flow
1. Sign in as teacher; go to **QR Sessions**, select a subject and generate the QR.
2. For a phone test, connect phone and laptop to the same Wi-Fi and use your laptop's LAN IP with port 3000; for camera/geolocation on a phone, use HTTPS in deployment. A local `http://localhost` is treated as a secure context on the same device.
3. Sign in as student on another browser/device. Scan QR or open its link, allow location and mark attendance.
4. Teacher closes session to record absent entries for students who did not check in.
5. Student dashboard displays subject attendance, low-attendance warning and recovery count.
6. Admin can adjust the attendance threshold under Settings.

## Attendance mathematics
Let `P` = lectures attended, `T` = lectures counted as held, and `R` = required percentage (default 75).

Current attendance = `(P / T) × 100`.

If below the target, the minimum number `x` of consecutive future lectures to attend is the smallest integer satisfying:
`((P + x) / (T + x)) × 100 >= R`.

Example: 42 present out of 60 held = 70%. To reach 75%:
`(42+x)/(60+x) >= 0.75` → `42+x >= 45+0.75x` → `0.25x >= 3` → `x >= 12`.
So attend the next **12 lectures** without absence to reach 75%.

Important: the number displayed is a recovery calculation, not an exemption or guarantee. It assumes every next lecture is attended and that the institution counts lectures exactly as represented. If attendance is already above target, the app estimates how many future lectures could be missed before dropping below the target.

## Deployment (Render)
This app is a Node web service and stores its demo database in `data.json`.
1. Create a GitHub repository and upload the extracted project files.
2. In Render choose **New → Web Service**, connect the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Set `NODE_VERSION` to a supported Node 18+ version if needed.
6. Deploy and open the Render URL. Browser camera/location permissions require HTTPS; Render provides HTTPS.
7. For persistent real use, attach a persistent disk and store `data.json` there, or migrate to PostgreSQL/Supabase. Render's ephemeral filesystem can reset on redeploy/restart.

Alternative: deploy as a Node service on Railway. Do not deploy this JSON-file prototype for real college records.

## Important production work still required
- Replace demo plaintext passwords with bcrypt/Argon2 and implement secure sessions/JWT, password reset and account provisioning.
- Replace JSON file storage with PostgreSQL/Supabase and enforce role-based access + row-level security server-side.
- Move QR tokens to cryptographically signed, one-use server-side sessions; rate-limit endpoints.
- Configure verified MITAOE campus/classroom coordinates and geofence radius with the college.
- Add email/SMS/push delivery; current alerts are in-app notifications visible after login.
- Add audit logs, data retention, backup, consent/privacy notices and an official manual correction workflow.
- Confirm current MITAOE attendance policy, exemptions, practical/tutorial rules and condonation process before institutional use.

## Attendance threshold note
The project defaults to 75%. A historical MITAOE IQAC minutes PDF for academic year 2016–17 refers to 75%, but this is not proof of the current 2026–27 policy. Confirm the current rule with the Examination Section / academic regulations. Admin can change the threshold.

## Project structure
```
MITAOE_SmartAttend/
  server.js
  package.json
  data.json        # generated automatically on first run; do not commit real student data
  public/
    index.html
    app.js
```
