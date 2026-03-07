'use server';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  // IMPORTANT: This is a placeholder for email sending.
  // You must configure this with your own email service provider's credentials.
  // For production, use environment variables to store sensitive data like API keys.
  // Add these to your .env file.
  const isConfigured = process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS;

  if (!isConfigured) {
    console.warn("EMAIL SENDING IS NOT CONFIGURED. Please set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS environment variables in your .env file.");
    // For this demo, we'll return a success response to not block the frontend flow,
    // but no email will actually be sent.
    return NextResponse.json({ message: 'Email service not configured. Skipped sending email.' });
  }

  const { to, subject, html } = await request.json();

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: (Number(process.env.EMAIL_PORT) || 587) === 465, // Use 'true' for port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"ProcureEase" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
    });
    return NextResponse.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Failed to send email via API route:', error);
    // We return a 500 error but the frontend should handle this gracefully.
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
