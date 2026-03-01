# ProcureEase - A Modern Procurement Portal

This project is a comprehensive Procurement Management System built with Next.js, Firebase, and ShadCN UI. It is designed to streamline the entire procurement lifecycle, from initial request to final fulfillment, with a sophisticated role-based access control system.

## Application Overview

This is a multi-user application designed to bring efficiency, transparency, and control to an organization's procurement process. It features a real-time database, robust user authentication, and a flexible, role-based permission system.

---

## Core Features & Functionality

**1. Role-Based Access Control (RBAC):**
The application's functionality is dictated by the user's assigned role. The primary roles include:
*   **Administrator:** Full access to all features, settings, and data.
*   **Requester:** Can create and submit procurement requests.
*   **Manager:** Can approve or reject requests from their department.
*   **Executive:** Higher-level approval authority.
*   **Procurement Officer / Assistant:** Manages the fulfillment process and vendor interactions.

**2. Procurement & Submission:**
*   **Quick Submit:** A centralized page for creating and managing procurement requests.
*   **Recurring Items:** A master list of items (e.g., monthly subscriptions) automatically added to new requests.
*   **Budget vs. Actuals Summary:** Real-time comparison of submitted requests against pre-loaded budget forecasts.
*   **Import/Export:** Ability to import line items from a CSV file.

**3. Approval Workflow:**
*   A multi-stage approval pipeline (e.g., Manager Review -> Executive Approval).
*   Approvers can review line items, see request history, and add comments or queries.
*   The workflow is fully customizable by an administrator on a per-department basis.

**4. Fulfillment Management:**
*   A dedicated dashboard for procurement officers to manage approved requests.
*   Track and update the status of each individual line item (Sourcing, Quoted, Ordered, Completed).
*   Log received quantities and add fulfillment-specific comments.

**5. System Administration & Settings:**
*   **User Management:** Administrators can manage user roles and department assignments.
*   **Department Management:** Create and manage departments and their annual budgets.
*   **Workflow Customization:** A drag-and-drop interface to define approval stages for each department.
*   **Budget Integration:** A tool to import departmental budget forecasts from CSV or Excel.
*   **Audit & Error Logging:** Comprehensive logs to track all user actions and capture client-side errors.

---

## Technical Services & Stack

*   **Frontend Framework:** Next.js with React (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS with ShadCN UI
*   **Database:** Cloud Firestore (NoSQL) for real-time data.
*   **Authentication:** Firebase Authentication (Google & Email/Password).
*   **Hosting:** Configured for **Firebase Hosting** (free tier).

## Enhanced Features

*   **Real-time Data:** The UI updates instantly for all users as data changes in the backend.
*   **Offline Capability:** The app works offline, syncing any changes once a connection is restored.
*   **Dynamic Theming:** Switch between modern Light, Dark, and "Classic" themes.

---

## Database Schema Layout

The Firestore database is structured into several top-level collections.

| Collection Path                             | Description                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `/users/{userId}`                           | Stores public profile information for each user.                          |
| `/departments/{departmentId}`               | Contains all departments, their budgets, and custom workflows.            |
| `/roles/{roleId}`                           | Defines all user roles and their specific permission sets.                |
| `/procurementRequests/{procurementRequestId}` | The core collection for all procurement submissions.                      |
| `/vendors/{vendorId}`                       | A list of all approved vendors and suppliers.                             |
| `/recurringItems/{recurringItemId}`         | The master list of automatically-added recurring procurement items.       |
| `/budgets/{budgetId}`                       | Stores all imported budget line items, linked to a department.            |
| `/auditLogs/{logId}`                        | A complete log of all significant user actions for security and tracking. |
| `/errorLogs/{errorLogId}`                   | A log of all client-side application errors for debugging purposes.       |
| `/app/metadata`                             | A single document for storing global application settings.                |

## Getting Started

To get the application running locally, follow these steps.

### Prerequisites

*   Node.js (v18 or later)
*   An active Firebase project.

### Local Development

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set Up Environment Variables:**
    Create a `.env.local` file in the root of the project and add your Firebase project configuration. You can get these values from the Firebase console.
    ```
    NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
    NEXT_PUBLIC_FIREBASE_APP_ID=1:...:web:...
    ```

3.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

### Publishing the Application

This application is configured for deployment using **Firebase App Hosting**. App Hosting integrates with GitHub to automatically build and deploy your Next.js application when you push to your repository.

#### Environment Variables for Deployment

Your Firebase configuration (API keys, etc.) is managed using environment variables. These are stored in your `.env.local` file for local development but **are not checked into GitHub for security reasons.**

To make these variables available to your deployed application, you must configure them as secrets in Google Cloud and link them to your App Hosting backend.

1.  **Go to Google Cloud Secret Manager:**
    *   Navigate to the [Secret Manager](https://console.cloud.google.com/security/secret-manager) page in the Google Cloud console for your Firebase project.

2.  **Create a Secret for Each Variable:**
    *   For each variable in your `.env` file (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY`), click **"Create Secret"**.
    *   Give the secret a name (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY`).
    *   In the "Secret value" field, paste the corresponding value from your `.env` file.
    *   Click **"Create secret"**. Repeat this for all `NEXT_PUBLIC_` variables.

3.  **Grant Access to the Service Account:**
    *   Find your App Hosting service account. It will be named `PROJECT_NUMBER@gcp-sa-apphosting.iam.gserviceaccount.com`. You can find your `PROJECT_NUMBER` on the [Google Cloud Dashboard](https://console.cloud.google.com/home/dashboard).
    *   For each secret you created, you need to grant this service account the **"Secret Manager Secret Accessor"** role.
    *   Select the secret, go to the **Permissions** tab, click **"Grant Access"**, add the service account as a new principal, and assign the role.

4.  **Connect Secrets in Firebase Console:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/) and navigate to the App Hosting page for your backend.
    *   You should see a section for environment variables where you can link the secrets you just created.

Once this is done, push a new commit to your repository to trigger a new build and deployment. The new deployment will have access to the correct API keys and the error will be resolved.
