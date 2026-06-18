# Deploy Login Fix Report

Date: 2026-06-18

## Issue

The deployed frontend could load, but login requests from `https://epiccv-frontend.vercel.app` failed in the browser.

## Root Causes

1. Backend core CORS only allowed `FRONTEND_URL` when that environment variable was configured. If the Render service did not have `FRONTEND_URL`, deployed Vercel requests did not receive `Access-Control-Allow-Origin`.
2. Backend `LoginDto` required passwords to be at least 12 characters, while the frontend sign-up form allowed 6 characters. Accounts using 6-11 character passwords could not pass backend validation.

## Fixes

- Added `https://epiccv-frontend.vercel.app` to backend core default allowed origins.
- Added support for comma-separated `FRONTEND_URLS` in addition to `FRONTEND_URL`.
- Added support for EpicCV Vercel preview domains matching `https://epiccv-frontend-*.vercel.app`.
- Added explicit `Content-Type` and `Authorization` allowed headers for CORS preflight.
- Aligned backend login password minimum length with the frontend at 6 characters.

## Verification

- Reproduced the deployed CORS problem with an `OPTIONS` preflight from `https://epiccv-frontend.vercel.app`.
- Ran backend core build after the fix.
