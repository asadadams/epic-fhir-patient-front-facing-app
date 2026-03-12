# Epic FHIR Patient App (SMART on FHIR)

This is a React + TypeScript + Vite demo of a patient-facing SMART on FHIR app using the JavaScript `fhirclient` library:

- Start authorization from `src/App.tsx` via `FHIR.oauth2.authorize(...)`
- Handle the OAuth redirect in `src/Callback.tsx` via `FHIR.oauth2.ready()`
- Read the current patient via `client.patient.read()`
- Fetch other resources via `client.request(...)` (example: `Observation`)

## Contents

- [Epic FHIR Patient App (SMART on FHIR)](#epic-fhir-patient-app-smart-on-fhir)
  - [Contents](#contents)
  - [What Is FHIR?](#what-is-fhir)
  - [What Is Epic (In This Context)?](#what-is-epic-in-this-context)
  - [How A Patient-Facing SMART App Works](#how-a-patient-facing-smart-app-works)
  - [Authorization In This Repo (`fhirclient`)](#authorization-in-this-repo-fhirclient)
    - [1) Start OAuth (App.tsx)](#1-start-oauth-apptsx)
    - [2) Finish OAuth + Get A Client (Callback.tsx)](#2-finish-oauth--get-a-client-callbacktsx)
  - [Getting FHIR Resources With `fhirclient`](#getting-fhir-resources-with-fhirclient)
    - [Read "the current patient"](#read-the-current-patient)
    - [Search / Query resources](#search--query-resources)
  - [Common Mistakes and Pitfalls](#common-mistakes-and-pitfalls)
    - [1) Callback / Redirect URI Not An Exact Match](#1-callback--redirect-uri-not-an-exact-match)
    - [2) Fetching A Resource Without The Right Scopes (Or Not Enabled In The App Registration)](#2-fetching-a-resource-without-the-right-scopes-or-not-enabled-in-the-app-registration)
    - [3) "I Don't See The App Creation Section In Epic"](#3-i-dont-see-the-app-creation-section-in-epic)
  - [Creating Your Own Patient-Facing Epic App (Checklist)](#creating-your-own-patient-facing-epic-app-checklist)
  - [Run Locally](#run-locally)
  - [Repo Map](#repo-map)

## What Is FHIR?

FHIR (Fast Healthcare Interoperability Resources) is a health data standard from HL7 that defines:

- A data model built around "Resources" like `Patient`, `Observation`, `Condition`, `MedicationRequest`
- A RESTful API style (URLs + HTTP verbs) and JSON representations
- Search conventions (for example: `GET /Observation?patient=123&category=laboratory`)
- Bundles and paging, since many queries can return multiple resources

In practice: you authenticate, then you make HTTPS requests to a FHIR server and receive JSON resources back.

## What Is Epic (In This Context)?

Epic is an EHR (Electronic Health Record) vendor. Epic sites can expose FHIR APIs for apps to read (and sometimes write) clinical data.

Common terms you will see:

- **Epic Interconnect**: Epic's integration platform. Epic-hosted sandboxes commonly use an Interconnect FHIR base URL.
- **Epic App Orchard**: Epic's developer program used to register apps, obtain client credentials, and configure redirect URIs and scopes.
- **SMART on FHIR**: The authorization model (OAuth 2.0 + OpenID Connect) used by many EHRs (including Epic) to allow apps to access FHIR resources on behalf of a user.

## How A Patient-Facing SMART App Works

At a high level, a patient-facing app is just a web or mobile app that:

1. Sends the user to the EHR authorization endpoint (via SMART on FHIR / OAuth 2.0)
2. Receives a redirect back to your app (your registered `redirect_uri`)
3. Exchanges authorization details for an access token (handled by `fhirclient`)
4. Calls the FHIR API with that token to read patient data

There are two common launch styles:

- **Standalone launch**: Your app starts the flow using a known FHIR base URL ("issuer", often called `iss`).
- **EHR launch**: The EHR launches your app and provides launch context.

This repo is written like a standalone flow by passing `iss` directly in `FHIR.oauth2.authorize(...)`.

## Authorization In This Repo (`fhirclient`)

### 1) Start OAuth (App.tsx)

`src/App.tsx` calls `FHIR.oauth2.authorize(...)`. This redirects the browser away from your app to Epic's authorization UI, then back to your callback route.

Key parameters:

- `client_id`: your app's client id from Epic App Orchard
- `iss`: the FHIR base URL (the SMART issuer)
- `redirect_uri`: must match exactly what you registered
- `scope`: what your app is requesting (for example patient read scopes)

Example (from this repo):

```ts
await FHIR.oauth2.authorize({
  client_id: "YOUR_CLIENT_ID",
  scope:
    "launch openid profile patient/Observation.read patient/Condition.read patient/MedicationRequest.read offline_access",
  iss: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
  redirect_uri: "http://localhost:5173/callback/",
});
```

Notes:

- `openid profile` indicates OpenID Connect sign-in (identity claims in addition to FHIR access).
- `offline_access` is typically used to request a refresh token (if the server supports it and your app is allowed).
- In production, prefer `redirect_uri: window.location.origin + "/callback"` so it matches your deployed host.
- Redirect URIs are usually exact-match in registrations: `/callback` and `/callback/` can be treated as different (see "Common Mistakes and Pitfalls").

### 2) Finish OAuth + Get A Client (Callback.tsx)

After the redirect, `src/Callback.tsx` calls `FHIR.oauth2.ready()`. That function:

- Restores the authorization state from storage
- Finalizes the token exchange (as needed)
- Returns a configured SMART client for making FHIR requests

Example (from this repo):

```ts
const client = await FHIR.oauth2.ready();
const patient = await client.patient.read();
```

## Getting FHIR Resources With `fhirclient`

Once you have a client from `FHIR.oauth2.ready()`, you can request resources in two common ways.

### Read "the current patient"

If your app has patient context, `fhirclient` exposes helpers:

```ts
const patient = await client.patient.read();
```

This corresponds to a `GET /Patient/{id}` call under the hood.

### Search / Query resources

Use `client.request(...)` with a relative URL:

```ts
const observations = await client.request(
  `Observation?patient=${client.patient.id}&limit=50&category=laboratory`,
  { pageLimit: 0, flat: true }
);
```

In this repo, that is implemented in `src/Callback.tsx` when you click "Get Observations".

Common patterns:

- Search: `Observation?patient=...`, `Condition?patient=...`
- Paging: pass `pageLimit: 0` to follow all pages (be careful with large datasets)
- Result shape: with `flat: true`, the library can return a flat array of resources instead of a Bundle

## Common Mistakes and Pitfalls

### 1) Callback / Redirect URI Not An Exact Match

Symptoms:

- Login succeeds, but the app fails on the callback page
- `FHIR.oauth2.ready()` rejects with "no active launch", "state not found", or similar
- Epic shows an error about redirect URI mismatch

What to check:

- The redirect URI in Epic App Orchard must match what your app uses exactly.
- Include scheme/host/port/path and be consistent about trailing slashes:
  - `http://localhost:5173/callback` is not always the same as `http://localhost:5173/callback/`
- This repo routes `"/callback"` in `src/main.tsx`, while `src/App.tsx` currently uses `"http://localhost:5173/callback/"`.

Recommendation:

- Pick one and make all three match: (1) Epic dashboard, (2) `redirect_uri` passed to `FHIR.oauth2.authorize`, (3) your router path.

### 2) Fetching A Resource Without The Right Scopes (Or Not Enabled In The App Registration)

Symptoms:

- `client.request(...)` fails for one resource type but other calls work
- Errors like `403 Forbidden`, `401 Unauthorized`, or `insufficient_scope`

What to check:

- Make sure your requested scopes include the resource you are trying to read (for example `patient/Observation.read`).
- Make sure those same scopes are configured/allowed for your app in Epic App Orchard.
- If you change scopes, you must re-run the login flow so you get a new token with the updated scopes.

Example from this repo:

- The app fetches lab observations with:
  - `Observation?patient=...&category=laboratory`
- For that to work, your registration and `scope` should include `patient/Observation.read`.

### 3) "I Don't See The App Creation Section In Epic"

Epic's portal UI varies by environment/program track, but the same concepts usually exist. If you cannot find a section, look for equivalents such as:

- "Redirect URIs" / "Callback URLs"
- "OAuth 2.0" / "SMART on FHIR" settings
- "FHIR API" permissions / "Scopes"
- "Client ID" / "Application Credentials"

Minimum fields/settings you typically need to provide:

- App name (anything)
- Redirect URI(s) (your callback URL)
- Authorized scopes (the exact SMART scopes your app will request)

If your dashboard is missing required sections entirely, it is usually an enrollment/permissions issue for that environment (for example sandbox vs production track, or your user account role). In that case, confirm you are creating the app under the correct program/environment and that your account has access to configure SMART scopes and redirect URIs.

## Creating Your Own Patient-Facing Epic App (Checklist)

1. Register the app in Epic App Orchard (Sandbox or Production track).
2. Add the exact redirect URI(s) you will use (exact match, including trailing slash).
3. Decide which scopes you need (start small; add more as required).
4. Configure your app with:
   - `client_id`
   - `iss` (FHIR base URL)
   - `redirect_uri`
5. Implement the SMART flow:
   - Call `FHIR.oauth2.authorize(...)`
   - Handle the redirect and call `FHIR.oauth2.ready()`
6. Use the resulting client to call FHIR endpoints with `client.patient.read()` and `client.request(...)`.

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:5173/` and click the login button.

## Repo Map

- `src/App.tsx`: starts SMART on FHIR authorization
- `src/Callback.tsx`: completes authorization and fetches data
- `src/main.tsx`: routes `/` and `/callback`
