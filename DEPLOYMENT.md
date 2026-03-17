# Deployment Guide

This guide provides the steps to save your code changes to GitHub and deploy your application to Vercel.

## 1. Saving Changes to GitHub

The changes made in Firebase Studio are applied to your local files. To save these changes to your GitHub repository, you need to use Git. Run these commands from your terminal in the project's root directory.

### Step 1: Stage All Changes

This command prepares all modified files to be saved.

```bash
git add .
```

### Step 2: Commit the Changes

This saves a snapshot of your files. Replace `"Your descriptive message here"` with a summary of the changes you've made (e.g., "Add Vercel deployment config").

```bash
git commit -m "Your descriptive message here"
```

### Step 3: Push to GitHub

This uploads your saved changes from your local 'main' branch to the 'main' branch on GitHub.

```bash
git push origin main
```

After these steps, your code will be up-to-date on GitHub.

## 2. Deploying to Vercel

This project is configured for seamless deployment to [Vercel](https://vercel.com/), the creators of Next.js.

### Step 1: Import Your Project in Vercel

1.  Go to your [Vercel dashboard](https://vercel.com/dashboard).
2.  Click the "Add New..." button and select "Project".
3.  Find your GitHub repository (`UX-UX2026/studio`) and click "Import".

Vercel will automatically detect that you are using Next.js and configure the build settings for you.

### Step 2: Configure Environment Variables

For your live, deployed application to connect to Firebase and other services, you **MUST** provide your credentials as **Environment Variables** in the Vercel project settings.

1.  During the import process, expand the "Environment Variables" section.
2.  Copy all the variables and their values from your local `.env` file and paste them into the Vercel dashboard.

### Step 3: Deploy

Click the "Deploy" button. Vercel will build your application and deploy it. Once finished, you will be given a live URL for your project.

---

**Remember:** Any time you push new changes to your GitHub repository's `main` branch, Vercel will automatically trigger a new deployment for you.
