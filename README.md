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
*   **Data Integrity with Digital Fingerprints:** Every approval or rejection action generates a unique cryptographic fingerprint (a SHA-256 hash) of the entire request data at that moment. This fingerprint is stored with the action and included in PDF exports, providing a verifiable, tamper-evident audit trail.

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

To get the application running, follow these steps.

### Prerequisites

*   Node.js (v18 or later)
*   An active Firebase project.

### Environment Configuration

This application uses environment variables to handle sensitive information like Firebase and email credentials securely.

1.  **Create an Environment File:**
    In the root of your project, create a new file named `.env` by copying the included placeholder variables.

2.  **Add Your Credentials:**
    Open your new `.env` file and replace the placeholder values with your actual credentials. You can find your Firebase configuration in your Firebase project settings.

    ```
    # Firebase Configuration
    NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
    # ...and so on for the other Firebase variables.

    # Email Configuration (for notifications)
    EMAIL_HOST="your_smtp_host"
    EMAIL_PORT=587
    # ...etc.
    ```
    **Important:** The `.env` file should not be committed to your GitHub repository.

### Running Locally

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

### Publishing the Application

This application is configured for deployment using **Firebase App Hosting**.

For your live, deployed application to connect to Firebase and send emails, you **MUST** provide your credentials using **Environment Variables** in your hosting provider's settings dashboard.

1.  Go to your hosting provider's dashboard (e.g., Firebase App Hosting, Vercel).
2.  Navigate to the environment variable settings for your project.
3.  Add all the variables from your `.env` file (both Firebase and Email variables) with their corresponding production values.

Your hosting provider will now build your application with the correct configuration, and your deployed site will be able to connect to Firebase securely.
