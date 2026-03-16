# Deployment Guide

This guide provides the steps to save your code changes to GitHub and deploy your application to Firebase Hosting.

## 1. Saving Changes to GitHub

The changes made in Firebase Studio are applied to your local files. To save these changes to your GitHub repository, you need to use Git. Run these commands from your terminal in the project's root directory.

### Step 1: Stage All Changes

This command prepares all modified files to be saved.

```bash
git add .
```

### Step 2: Commit the Changes

This saves a snapshot of your files. Replace `"Your descriptive message here"` with a summary of the changes you've made (e.g., "Add company linking and update PDF headers").

```bash
git commit -m "Your descriptive message here"
```

### Step 3: Push to GitHub

This uploads your saved changes from your local 'main' branch to the 'main' branch on GitHub.

```bash
git push origin main
```

After these steps, your code will be up-to-date on GitHub.

## 2. Deploying to Firebase

This project is set up for Firebase App Hosting.

### Step 1: Build the Project

First, you need to build the application for production.

```bash
npm run build
```

### Step 2: Deploy to Firebase

Use the Firebase CLI to deploy your built application.

```bash
firebase deploy
```

The CLI will provide a URL to your live, deployed application once it's finished.

---

**Remember:** For your live application to work, you must set your Firebase configuration (from your `.env` file) as environment variables in the Firebase App Hosting settings in the Firebase Console.