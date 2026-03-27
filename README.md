# ProcureEase - A Modern Procurement Portal

This project is a comprehensive Procurement Management System built with Next.js, Firebase, and ShadCN UI. It is designed to streamline the entire procurement lifecycle, from initial request to final fulfillment, with a sophisticated role-based access control system.

## Application Overview

This is a multi-user application designed to bring efficiency, transparency, and control to an organization's procurement process. It features a real-time database, robust user authentication, and a flexible, role-based permission system.

---

## Core Features & Functionality

### 1. Role-Based Access Control (RBAC)
The application's functionality is dictated by the user's assigned role. This ensures that users only see and interact with the data and features relevant to their position.

-   **Administrator:** Has unrestricted access to all features, settings, and data. Responsible for system configuration, user management, and overall oversight.
-   **Requester:** The primary role for initiating procurement. Can create, save, and submit procurement requests for their assigned department.
-   **Manager:** The first line of approval. Can review, approve, reject, or raise queries on requests submitted by users within their department.
-   **Executive:** Provides a higher level of approval, typically for requests that exceed a certain value or fall under specific categories, after they have been approved by a manager.
-   **Procurement Officer / Assistant:** Manages the entire fulfillment process for approved requests, including sourcing from vendors, tracking orders, and logging received goods.

### 2. Procurement & Submission (`Quick Submit` Page)
A centralized hub for creating and managing procurement requests.

-   **Start a New Request:** Select a department and a procurement period (e.g., 'August 2026') to begin a new submission.
-   **Automated Recurring Items:** A master list of recurring monthly expenses (like subscriptions or service contracts) is automatically added to each new submission, saving time and ensuring consistency.
-   **Add & Manage Line Items:** Easily add "One-Off" items, specifying description, category, quantity, and price. Edit or remove items as needed before submission.
-   **Save as Draft:** Save your progress at any time. The request will be available on your dashboard to resume later.
-   **Import from CSV:** Quickly populate a submission by importing a list of line items from a CSV file.
-   **Budget vs. Actuals Summary:** A real-time, color-coded summary compares the total value of your request against the department's pre-loaded budget forecast for the selected period, helping to prevent overspending.

### 3. Approval Workflow (`Approvals` Page)
A multi-stage approval pipeline designed for clarity and accountability.

-   **Pipeline View:** Requests move through a clear workflow (e.g., Manager Review → Executive Approval → Approved for Procurement).
-   **Detailed Review:** Approvers can drill down into any request to view all line items, see the budget impact, and review the full history.
-   **Action-Oriented Interface:** Approvers can approve, reject, or raise queries on a request with a single click. Rejections and queries require comments, ensuring clear communication.
-   **Digital Fingerprints:** Every approval or rejection action generates a unique cryptographic fingerprint (a SHA-256 hash) of the entire request data at that moment. This fingerprint is stored with the action, providing a verifiable, tamper-evident audit trail.
-   **Automated Notifications:** Email notifications are sent to the relevant users when an action is required on a request.

### 4. Fulfillment Management (`Fulfillment` Page)
A dedicated dashboard for procurement staff to manage the final stage of the process.

-   **Fulfillment Tracking:** For each line item in an approved request, procurement officers can update the status: **Sourcing, Quoted, Ordered,** and **Completed**.
-   **Quantity & Comment Logging:** Track the quantity of items received and add fulfillment-specific comments or notes for each line item.
-   **AI-Powered Recommendations:** Leverage AI to get suggestions for optimal fulfillment strategies, including potential vendors and estimated lead times.

### 5. System Administration & Settings (`Settings` Pages)
A comprehensive suite of tools for administrators to configure and maintain the application.

-   **User Management:** Create users, assign roles, and manage department associations.
-   **Department & Company Management:** Create and manage departments and legal entities.
-   **Workflow Customization:** A drag-and-drop interface to define the approval stages and permissions for each department.
-   **Budget Integration:** Import departmental budget forecasts from CSV or Excel files for real-time comparison against procurement requests.
-   **Audit & Error Logging:** Comprehensive logs to track all significant user actions and capture client-side errors for debugging.

---

## Technical Services & Stack

*   **Frontend Framework:** Next.js with React (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS with ShadCN UI
*   **Database:** Cloud Firestore (NoSQL) for real-time data.
*   **Authentication:** Firebase Authentication (Google & Email/Password).
*   **Hosting:** Configured for seamless deployment on Vercel or Firebase Hosting.

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

This application is configured for deployment using **Vercel** or **Firebase App Hosting**.

For your live, deployed application to connect to Firebase and send emails, you **MUST** provide your credentials using **Environment Variables** in your hosting provider's settings dashboard.

1.  Go to your hosting provider's dashboard (e.g., Vercel).
2.  Navigate to the environment variable settings for your project.
3.  Add all the variables from your `.env` file (both Firebase and Email variables) with their corresponding production values.

Your hosting provider will now build your application with the correct configuration, and your deployed site will be able to connect to Firebase securely.
